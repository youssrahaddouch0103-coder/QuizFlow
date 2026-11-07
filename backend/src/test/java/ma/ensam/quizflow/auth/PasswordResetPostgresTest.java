package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.AppProperties;
import ma.ensam.quizflow.mail.PasswordResetMailer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
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

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(showSql = false, properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({PasswordResetRepository.class, AuthRateLimitRepository.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class PasswordResetPostgresTest {
    private static final String EMAIL = "password-reset@example.org";
    private static final String IP = "192.0.2.1";
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-01-01T12:00:00Z"), ZoneOffset.UTC);

    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired TeacherRepository teachers;
    @Autowired PasswordResetRepository repository;
    @Autowired AuthRateLimitRepository rateRepository;
    @Autowired PlatformTransactionManager manager;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private PasswordResetService service;
    private PasswordResetMailer mailer;

    @BeforeEach
    void setup() {
        jdbc.update("DELETE FROM teachers");
        jdbc.update("DELETE FROM auth_rate_limits");
        var codes = new VerificationCodeService(VerificationCodeServiceTest.properties());
        var limits = new AuthRateLimitService(rateRepository, codes, CLOCK, manager);
        mailer = mock(PasswordResetMailer.class);
        doAnswer(invocation -> {
            invocation.getArgument(0, Runnable.class).run();
            return null;
        }).when(mailer).enqueue(any());
        service = new PasswordResetService(repository, encoder, codes, limits, mailer, CLOCK, manager);
    }

    @Test
    void resetConsumesCodeAndRevokesOldJwt() {
        Teacher teacher = createAccount();
        var props = new AppProperties(new AppProperties.Jwt("test-key-for-jwt-verification-0123456789", 1),
                null, null, null, null);
        var jwt = new JwtService(props, teachers);
        String oldToken = jwt.generate(teacher);
        assertThat(jwt.parse(oldToken)).isPresent();

        String code = requestCode();
        service.reset(EMAIL, code, "nouveau-secret", IP);

        Teacher updated = teachers.findById(teacher.getId()).orElseThrow();
        assertThat(encoder.matches("nouveau-secret", updated.getPasswordHash())).isTrue();
        assertThat(encoder.matches("ancien-secret", updated.getPasswordHash())).isFalse();
        assertThat(jwt.parse(oldToken)).isEmpty();
        assertThat(jwt.parse(jwt.generate(updated))).isPresent();
        assertThat(repository.findCode(teacher.getId())).isEmpty();
        verify(mailer).sendConfirmation(EMAIL);

        assertThatThrownBy(() -> service.reset(EMAIL, code, "autre-secret", IP))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsIncorrectAndExpiredCodes() {
        Teacher teacher = createAccount();
        String code = requestCode();
        String wrongCode = code.equals("000000") ? "000001" : "000000";
        assertThatThrownBy(() -> service.reset(EMAIL, wrongCode, "nouveau-secret", IP))
                .isInstanceOf(ApiException.class);

        jdbc.update("UPDATE password_reset_codes SET expires_at = ? WHERE teacher_id = ?",
                java.sql.Timestamp.from(CLOCK.instant()), teacher.getId());
        assertThatThrownBy(() -> service.reset(EMAIL, code, "nouveau-secret", IP))
                .isInstanceOf(ApiException.class);
        assertThat(teachers.findById(teacher.getId()).orElseThrow().getAuthVersion()).isZero();
    }

    private Teacher createAccount() {
        return teachers.saveAndFlush(new Teacher(EMAIL, encoder.encode("ancien-secret"), "Compte de test"));
    }

    private String requestCode() {
        service.requestCode("PASSWORD-RESET@example.org", IP);
        var delivered = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendCode(eq(EMAIL), delivered.capture(), eq(10L));
        return delivered.getValue();
    }
}
