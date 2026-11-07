package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.config.EmailVerificationProperties;
import ma.ensam.quizflow.mail.PasswordResetMailer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/** Mode développement (app.mail.mode=log) : démarrage sans SMTP ni clé HMAC configurés. */
class DevMailModeTest {

    private static EmailVerificationProperties withoutKey() {
        var p = VerificationCodeServiceTest.properties();
        return new EmailVerificationProperties("", p.from(), p.codeTtl(), p.resendDelay(), p.retention(),
                p.maxAttempts(), p.emailRequestsPerHour(), p.ipRequestsPerMinute());
    }

    @Test void logModeGeneratesATemporaryKey() {
        var service = new VerificationCodeService(withoutKey(), "log");
        UUID id = UUID.randomUUID();
        assertThat(service.fingerprint(id, 1, "123456")).hasSize(32);
    }

    @Test void smtpModeStillRequiresAKey() {
        assertThatThrownBy(() -> new VerificationCodeService(withoutKey(), "smtp"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test void resetMailerLogsInsteadOfFailingWithoutSmtp() {
        var noSender = new DefaultListableBeanFactory().getBeanProvider(JavaMailSender.class);
        var mailer = new PasswordResetMailer(noSender, VerificationCodeServiceTest.properties());
        assertThatCode(() -> mailer.sendCode("user@example.org", "123456", 15)).doesNotThrowAnyException();
    }
}
