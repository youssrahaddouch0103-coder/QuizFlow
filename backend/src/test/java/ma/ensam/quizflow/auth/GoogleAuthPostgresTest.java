package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(showSql = false, properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({GoogleAuthService.class, PendingRegistrationRepository.class,
        VerifiedAccountEmailRepository.class, GoogleAuthPostgresTest.Beans.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class GoogleAuthPostgresTest {
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired GoogleAuthService google;
    @Autowired TeacherRepository teachers;
    @Autowired PasswordEncoder passwords;
    @Autowired JwtService jwt;

    @Test
    void createsAccountAndRejectsReplayEvenWithOriginalCookie() {
        var challenge = google.issueChallenge();
        var identity = identity("google-new", "new@gmail.com", challenge, true);
        assertError("GOOGLE_CREDENTIAL_INVALID", () -> google.openSession(identity, UUID.randomUUID().toString()));
        var result = google.openSession(identity, challenge.browserProof());
        assertThat(result.teacher().email()).isEqualTo("new@gmail.com");
        assertThat(jwt.parse(result.token())).isPresent();
        assertError("GOOGLE_CREDENTIAL_INVALID", () -> google.openSession(identity, challenge.browserProof()));

        var next = google.issueChallenge();
        var returning = identity("google-new", "changed@gmail.com", next, true);
        assertThat(google.openSession(returning, next.browserProof()).teacher().id())
                .isEqualTo(result.teacher().id());
        assertThat(teachers.findByEmailIgnoreCase("changed@gmail.com")).isEmpty();
    }

    @Test
    void automaticallyLinksVerifiedGmailAndPreservesExistingPassword() {
        String email = "existing@gmail.com";
        var teacher = teachers.saveAndFlush(new Teacher(email, passwords.encode("password-correct"), "Prof"));
        var challenge = google.issueChallenge();
        var identity = identity("google-existing", email, challenge, true);
        assertThat(google.openSession(identity, challenge.browserProof()).teacher().id())
                .isEqualTo(teacher.getId());
        var saved = teachers.findById(teacher.getId()).orElseThrow();
        assertThat(saved.getPasswordHash()).isEqualTo(teacher.getPasswordHash());
        assertThat(passwords.matches("password-correct", saved.getPasswordHash())).isTrue();

        var next = google.issueChallenge();
        assertError("GOOGLE_ALREADY_LINKED", () -> google.openSession(
                identity("other-google", email, next, true), next.browserProof()));
    }

    @Test
    void rejectsFastSignupForThirdPartyEmail() {
        var challenge = google.issueChallenge();
        var identity = identity("external-google", "external@example.org", challenge, false);
        assertError("GOOGLE_EMAIL_UNSUPPORTED", () -> google.openSession(identity, challenge.browserProof()));
        assertThat(teachers.findByEmailIgnoreCase(identity.email())).isEmpty();
    }

    @Test
    void automaticallyLinksVerifiedWorkspaceAddress() {
        var teacher = teachers.saveAndFlush(new Teacher("prof@university.example", passwords.encode("secret"), "Prof"));
        var challenge = google.issueChallenge();
        var identity = identity("workspace-prof", teacher.getEmail(), challenge, true);
        assertThat(google.openSession(identity, challenge.browserProof()).teacher().id()).isEqualTo(teacher.getId());
    }

    @Test
    void rejectsAutomaticLinkForThirdPartyEmailEvenWhenAccountExists() {
        var teacher = teachers.saveAndFlush(new Teacher("external-existing@example.org", passwords.encode("secret"), "Prof"));
        var challenge = google.issueChallenge();
        var identity = identity("external-existing", teacher.getEmail(), challenge, false);
        assertError("GOOGLE_EMAIL_UNSUPPORTED", () -> google.openSession(identity, challenge.browserProof()));
        assertThat(teachers.findById(teacher.getId()).orElseThrow().getPasswordHash()).isEqualTo(teacher.getPasswordHash());
    }

    private static GoogleTokenVerifier.Identity identity(String subject, String email,
            GoogleAuthService.Challenge challenge, boolean hostedEmail) {
        return new GoogleTokenVerifier.Identity(subject, email, "Prof Google", challenge.nonce(), hostedEmail);
    }

    private static void assertError(String code, org.assertj.core.api.ThrowableAssert.ThrowingCallable action) {
        assertThatThrownBy(action).isInstanceOfSatisfying(ApiException.class,
                error -> assertThat(error.getCode()).isEqualTo(code));
    }

    @TestConfiguration
    static class Beans {
        @Bean Clock clock() { return Clock.systemUTC(); }
        @Bean PasswordEncoder passwords() { return new BCryptPasswordEncoder(4); }
        @Bean VerificationCodeService codes() {
            return new VerificationCodeService(VerificationCodeServiceTest.properties());
        }
        @Bean JwtService jwt(TeacherRepository teachers) {
            var props = new AppProperties(new AppProperties.Jwt("test-key-for-jwt-verification-0123456789", 1),
                    null, null, null, null);
            return new JwtService(props, teachers);
        }
    }
}
