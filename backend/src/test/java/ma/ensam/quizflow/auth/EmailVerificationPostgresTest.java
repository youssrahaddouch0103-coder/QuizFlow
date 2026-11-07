package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.auth.AuthDtos.RegisterRequest;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.mail.EmailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.*;
import java.util.Map;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Runs Flyway ONLY against a disposable PostgreSQL container, never application.yml's DB. */
@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(showSql = false, properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({PendingRegistrationRepository.class, VerifiedAccountEmailRepository.class, AuthRateLimitRepository.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class EmailVerificationPostgresTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired JdbcTemplate jdbc;
    @Autowired TeacherRepository teachers;
    @Autowired PendingRegistrationRepository pending;
    @Autowired VerifiedAccountEmailRepository verified;
    @Autowired AuthRateLimitRepository rateRepository;
    @Autowired PlatformTransactionManager manager;
    private final AdjustableClock clock = new AdjustableClock();
    private final EmailService mail = mock(EmailService.class);
    private final Map<String, String> deliveredCodes = new ConcurrentHashMap<>();
    private EmailVerificationService service;

    @BeforeEach void setup() {
        jdbc.update("DELETE FROM verified_account_emails");
        jdbc.update("DELETE FROM pending_registrations");
        jdbc.update("DELETE FROM auth_rate_limits");
        jdbc.update("DELETE FROM teachers");
        reset(mail);
        deliveredCodes.clear();
        clock.now.set(Instant.parse("2026-01-01T12:00:00Z"));
        doAnswer(inv -> { deliveredCodes.put(inv.getArgument(0), inv.getArgument(1)); return null; })
                .when(mail).sendVerification(anyString(), anyString(), anyLong());
        var properties = VerificationCodeServiceTest.properties();
        var codes = new VerificationCodeService(properties);
        var limits = new AuthRateLimitService(rateRepository, codes, clock, manager);
        var jwt = mock(JwtService.class);
        when(jwt.generate(any())).thenReturn("test-token");
        service = new EmailVerificationService(pending, verified, teachers, new BCryptPasswordEncoder(4),
                jwt, codes, limits, mail, properties, clock, manager);
    }

    private RegisterRequest request() { return new RegisterRequest("person@example.org", "motdepasse", "Personne"); }

    @Test void onlyVerificationCreatesAccountAndReplayFails() {
        var result = service.start(request());
        assertThat(teachers.count()).isZero();
        assertThatThrownBy(() -> new AuthService(teachers, new BCryptPasswordEncoder(4), mock(JwtService.class), service)
                .login(new AuthDtos.LoginRequest(request().email(), request().password()))).isInstanceOf(ApiException.class);
        var auth = service.verify(result.challengeId(), deliveredCodes.get(request().email()));
        assertThat(auth.token()).isEqualTo("test-token");
        assertThat(teachers.count()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM verified_account_emails", Long.class)).isEqualTo(1);
        assertThat(pending.find(result.challengeId())).isEmpty();
        assertThatThrownBy(() -> service.verify(result.challengeId(), deliveredCodes.get(request().email())))
                .isInstanceOf(ApiException.class);
    }

    @Test void failedAttemptsPersistAndSixthAttemptIsBlocked() {
        var result = service.start(request());
        String correct = deliveredCodes.get(request().email());
        String wrong = correct.equals("000000") ? "000001" : "000000";
        for (int i = 1; i <= 5; i++) {
            assertThatThrownBy(() -> service.verify(result.challengeId(), wrong)).isInstanceOf(ApiException.class);
            assertThat(pending.find(result.challengeId()).orElseThrow().failedAttempts()).isEqualTo(i);
        }
        assertThatThrownBy(() -> service.verify(result.challengeId(), correct))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        assertThat(teachers.count()).isZero();
    }

    @Test void expiryAndResendAreEnforcedWithCommittedState() {
        var result = service.start(request());
        byte[] oldMac = pending.find(result.challengeId()).orElseThrow().codeMac();
        assertThatThrownBy(() -> service.resend(result.challengeId())).isInstanceOf(ApiException.class);
        clock.now.updateAndGet(t -> t.plusSeconds(600));
        assertThatThrownBy(() -> service.verify(result.challengeId(), deliveredCodes.get(request().email())))
                .isInstanceOf(ApiException.class);
        service.resend(result.challengeId());
        var current = pending.find(result.challengeId()).orElseThrow();
        assertThat(current.codeVersion()).isEqualTo(2);
        assertThat(current.codeMac()).isNotEqualTo(oldMac);
        service.verify(result.challengeId(), deliveredCodes.get(request().email()));
        assertThat(teachers.count()).isEqualTo(1);
    }

    @Test void simultaneousConfirmationCreatesExactlyOneAccount() throws Exception {
        var result = service.start(request());
        String code = deliveredCodes.get(request().email());
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<Boolean> confirm = () -> {
                barrier.await(10, TimeUnit.SECONDS);
                try { service.verify(result.challengeId(), code); return true; }
                catch (ApiException expected) { return false; }
            };
            var a = executor.submit(confirm);
            var b = executor.submit(confirm);
            assertThat(a.get(20, TimeUnit.SECONDS) ^ b.get(20, TimeUnit.SECONDS)).isTrue();
        }
        assertThat(teachers.count()).isEqualTo(1);
    }

    @Test void simultaneousRegistrationsWithSameCredentialsShareOneChallenge() throws Exception {
        var barrier = new CyclicBarrier(2);
        try (var executor = Executors.newFixedThreadPool(2)) {
            Callable<java.util.UUID> start = () -> { barrier.await(10, TimeUnit.SECONDS); return service.start(request()).challengeId(); };
            var a = executor.submit(start);
            var b = executor.submit(start);
            assertThat(a.get(20, TimeUnit.SECONDS)).isEqualTo(b.get(20, TimeUnit.SECONDS));
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pending_registrations", Long.class)).isEqualTo(1);
        verify(mail, times(1)).sendVerification(anyString(), anyString(), anyLong());
    }

    @Test void smtpFailureRollsBackAndRetryCanSucceed() {
        doThrow(new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_UNAVAILABLE", "Indisponible"))
                .doAnswer(inv -> { deliveredCodes.put(inv.getArgument(0), inv.getArgument(1)); return null; })
                .when(mail).sendVerification(anyString(), anyString(), anyLong());
        assertThatThrownBy(() -> service.start(request())).isInstanceOf(ApiException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM pending_registrations", Long.class)).isZero();
        var response = service.start(request());
        service.verify(response.challengeId(), deliveredCodes.get(request().email()));
        assertThat(teachers.count()).isEqualTo(1);
    }

    @Test void emailQuotaSurvivesNewServiceInstances() {
        for (int i = 0; i < 5; i++) service.start(request());
        assertThatThrownBy(() -> service.start(request())).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
        var fresh = new AuthRateLimitService(rateRepository, new VerificationCodeService(VerificationCodeServiceTest.properties()), clock, manager);
        assertThatThrownBy(() -> fresh.consume("email-send", request().email(), 5, Duration.ofHours(1))).isInstanceOf(ApiException.class);
    }

    static final class AdjustableClock extends Clock {
        final AtomicReference<Instant> now = new AtomicReference<>(Instant.now());
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now.get(); }
    }
}
