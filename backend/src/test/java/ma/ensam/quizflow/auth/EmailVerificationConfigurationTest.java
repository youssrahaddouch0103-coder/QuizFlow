package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.config.EmailVerificationConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import static org.assertj.core.api.Assertions.*;

class EmailVerificationConfigurationTest {
    @Test void noImplicitLocalSmtpFallback() {
        assertThatThrownBy(() -> new EmailVerificationConfiguration().verificationMailSender(new MailProperties()))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test void smtpIsBoundedTlsCheckedAndDebugForcedOff() {
        var properties = new MailProperties();
        properties.setHost("smtp.example.org");
        properties.getProperties().put("mail.debug", "true");
        properties.getProperties().put("mail.smtp.timeout", "0");
        var sender = (JavaMailSenderImpl) new EmailVerificationConfiguration().verificationMailSender(properties);
        var settings = sender.getJavaMailProperties();
        assertThat(settings.getProperty("mail.debug")).isEqualTo("false");
        assertThat(settings.getProperty("mail.smtp.timeout")).isEqualTo("5000");
        assertThat(settings.getProperty("mail.smtp.ssl.checkserveridentity")).isEqualTo("true");
        assertThat(settings.getProperty("mail.smtp.starttls.required")).isEqualTo("true");
    }
}
