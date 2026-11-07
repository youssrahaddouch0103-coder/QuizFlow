package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.auth.AuthDtos.RegisterRequest;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.EmailVerificationProperties;
import ma.ensam.quizflow.mail.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailVerificationServiceTest {
    private final PendingRegistrationRepository pending = mock(PendingRegistrationRepository.class);
    private final VerifiedAccountEmailRepository verified = mock(VerifiedAccountEmailRepository.class);
    private final TeacherRepository teachers = mock(TeacherRepository.class);
    private final JwtService jwt = mock(JwtService.class);
    private final AuthRateLimitService limits = mock(AuthRateLimitService.class);
    private final EmailService mail = mock(EmailService.class);
    private final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    private final EmailVerificationProperties properties = VerificationCodeServiceTest.properties();
    private final VerificationCodeService codes = new VerificationCodeService(properties);
    private final Instant now = Instant.parse("2026-01-01T12:00:00Z");
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private EmailVerificationService service;

    @BeforeEach void setup() {
        when(manager.getTransaction(any(TransactionDefinition.class))).thenAnswer(inv -> new SimpleTransactionStatus());
        service = new EmailVerificationService(pending, verified, teachers, encoder, jwt, codes, limits, mail,
                properties, Clock.fixed(now, ZoneOffset.UTC), manager);
    }

    private PendingRegistration registration(Instant expiry, int failures) {
        UUID id = UUID.randomUUID();
        var p = new PendingRegistration(id, "user@example.org", encoder.encode("motdepasse"), "Nom",
                codes.fingerprint(id, 1, "012345"), 1, failures, expiry, now.minusSeconds(1), now.minusSeconds(120));
        when(pending.find(id)).thenReturn(Optional.of(p));
        when(pending.findLocked(id)).thenReturn(Optional.of(p));
        return p;
    }

    @Test void registrationStoresOnlyHashAndSendsCodeWithoutCreatingAccount() {
        var response = service.start(new RegisterRequest("USER@example.org", "motdepasse", " Nom "));
        var argument = ArgumentCaptor.forClass(PendingRegistration.class);
        verify(pending).insert(argument.capture(), eq(now));
        var p = argument.getValue();
        assertThat(p.email()).isEqualTo("user@example.org");
        assertThat(p.displayName()).isEqualTo("Nom");
        assertThat(encoder.matches("motdepasse", p.passwordHash())).isTrue();
        var sentCode = ArgumentCaptor.forClass(String.class);
        verify(mail).sendVerification(eq(p.email()), sentCode.capture(), eq(10L));
        assertThat(codes.matches(p, sentCode.getValue())).isTrue();
        assertThat(response.challengeId()).isEqualTo(p.id());
        assertThat(response.toString()).doesNotContain(sentCode.getValue());
        verify(teachers, never()).saveAndFlush(any());
        verifyNoInteractions(jwt, verified);
    }

    @Test void existingAccountReturnsNeutralResponseWithoutEmailOrJwt() {
        when(teachers.findByEmailIgnoreCase("user@example.org")).thenReturn(Optional.of(new Teacher("user@example.org", "hash", "Nom")));
        var response = service.start(new RegisterRequest("user@example.org", "motdepasse", "Nom"));
        assertThat(response.challengeId()).isNotNull();
        verify(pending, never()).insert(any(), any());
        verifyNoInteractions(mail, jwt, verified);
    }

    @Test void repeatedRegistrationCannotReplacePendingPasswordOrRevealId() {
        var p = registration(now.plusSeconds(600), 0);
        when(pending.findByEmail(p.email())).thenReturn(Optional.of(p));
        var response = service.start(new RegisterRequest(p.email(), "different-password", "Autre nom"));
        assertThat(response.challengeId()).isNotEqualTo(p.id());
        verify(pending, never()).insert(any(), any());
        verifyNoInteractions(mail);
    }

    @Test void wrongCodeCommitsCounterBeforeReturningError() {
        var p = registration(now.plusSeconds(600), 0);
        assertThatThrownBy(() -> service.verify(p.id(), "999999")).isInstanceOf(ApiException.class);
        var order = inOrder(pending, manager);
        order.verify(pending).failedAttempt(p.id(), now);
        order.verify(manager).commit(any());
        verify(manager, never()).rollback(any());
        verifyNoInteractions(jwt, verified);
    }

    @Test void originalPasswordResumesPendingRegistrationAndAllowsResend() {
        var p = registration(now.minusSeconds(1), 0);
        when(pending.findByEmail(p.email())).thenReturn(Optional.of(p));

        var resumed = service.start(new RegisterRequest(p.email(), "motdepasse", "Autre nom"));

        assertThat(resumed.challengeId()).isEqualTo(p.id());
        assertThat(resumed.expiresAt()).isEqualTo(p.expiresAt());
        assertThat(resumed.resendAvailableAt()).isEqualTo(p.resendAvailableAt());
        verify(pending, never()).insert(any(), any());
        verifyNoInteractions(mail);

        var resent = service.resend(resumed.challengeId());
        assertThat(resent.expiresAt()).isAfter(resumed.expiresAt());
        verify(mail).sendVerification(eq(p.email()), matches("[0-9]{6}"), eq(10L));
    }

    @Test void expiredCodeCannotCreateAccount() {
        var p = registration(now, 0);
        assertThatThrownBy(() -> service.verify(p.id(), "012345")).isInstanceOf(ApiException.class);
        verify(teachers, never()).saveAndFlush(any());
    }

    @Test void sixthAttemptIsRejectedEvenWithCorrectCode() {
        var p = registration(now.plusSeconds(600), 5);
        assertThatThrownBy(() -> service.verify(p.id(), "012345"))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        verify(teachers, never()).saveAndFlush(any());
    }

    @Test void validCodeCreatesVerifiedAccountAndDeletesChallenge() {
        var p = registration(now.plusSeconds(600), 0);
        Teacher teacher = mock(Teacher.class);
        when(teacher.getId()).thenReturn(42L);
        when(teachers.saveAndFlush(any())).thenReturn(teacher);
        when(jwt.generate(teacher)).thenReturn("test-jwt");
        assertThat(service.verify(p.id(), "012345").token()).isEqualTo("test-jwt");
        verify(verified).insert(42L, now);
        verify(pending).delete(p.id());
        verify(manager).commit(any());
    }

    @Test void consumedOrUnknownChallengeIsRejected() {
        assertThatThrownBy(() -> service.verify(UUID.randomUUID(), "012345")).isInstanceOf(ApiException.class);
        verifyNoInteractions(jwt, verified);
    }

    @Test void resendChangesVersionAndKeepsGlobalQuotas() {
        var p = registration(now.minusSeconds(1), 5);
        service.resend(p.id());
        verify(pending).replaceCode(eq(p.id()), any(), eq(2), eq(now.plusSeconds(600)), eq(now.plusSeconds(60)), eq(now));
        verify(limits).consume(eq("email-send"), eq(p.email()), eq(5), any());
        verify(mail).sendVerification(eq(p.email()), matches("[0-9]{6}"), eq(10L));
    }

    @Test void resendTooSoonDoesNotSend() {
        var p = registration(now.plusSeconds(600), 0);
        var recent = new PendingRegistration(p.id(), p.email(), p.passwordHash(), p.displayName(), p.codeMac(),
                1, 0, p.expiresAt(), now.plusSeconds(60), now);
        when(pending.findLocked(p.id())).thenReturn(Optional.of(recent));
        assertThatThrownBy(() -> service.resend(p.id())).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("VERIFICATION_RESEND_TOO_SOON"));
        verifyNoInteractions(mail);
    }

    @Test void smtpFailureRollsBackPendingRegistration() {
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_UNAVAILABLE", "Indisponible"))
                .when(mail).sendVerification(anyString(), anyString(), anyLong());
        assertThatThrownBy(() -> service.start(new RegisterRequest("user@example.org", "motdepasse", "Nom"))).isInstanceOf(ApiException.class);
        verify(manager).rollback(any());
        verify(manager, never()).commit(any());
    }

    @Test void bcryptLimitIsCheckedInUtf8Bytes() {
        assertThatThrownBy(() -> service.start(new RegisterRequest("user@example.org", "é".repeat(37), "Nom")))
                .isInstanceOf(ApiException.class);
        verifyNoInteractions(pending, mail);
    }

    @Test void legacyLoginStillUsesExistingPasswordAndJwt() {
        var teacher = new Teacher("legacy@example.org", encoder.encode("motdepasse"), "Nom");
        when(teachers.findByEmailIgnoreCase("legacy@example.org")).thenReturn(Optional.of(teacher));
        when(jwt.generate(teacher)).thenReturn("legacy-token");
        var auth = new AuthService(teachers, encoder, jwt, service);
        assertThat(auth.login(new AuthDtos.LoginRequest("legacy@example.org", "motdepasse")).token()).isEqualTo("legacy-token");
        verifyNoInteractions(pending, verified, mail);
    }
}
