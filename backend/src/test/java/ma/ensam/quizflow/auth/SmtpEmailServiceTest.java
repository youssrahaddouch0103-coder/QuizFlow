package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.mail.SmtpEmailService;
import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SmtpEmailServiceTest {
    @Test void smtpDetailsAndCodeDoNotEscapeInErrorOrCause() {
        var sender = mock(JavaMailSender.class);
        doThrow(new MailSendException("SMTP details: 123456 password internal-host"))
                .when(sender).send(any(SimpleMailMessage.class));
        var mail = new SmtpEmailService(sender, VerificationCodeServiceTest.properties());
        assertThatThrownBy(() -> mail.sendVerification("user@example.org", "123456", 10))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getCode()).isEqualTo("EMAIL_DELIVERY_UNAVAILABLE");
                    assertThat(e.getMessage()).doesNotContain("123456", "password", "internal-host");
                    assertThat(e.getCause()).isNull();
                });
    }
}
