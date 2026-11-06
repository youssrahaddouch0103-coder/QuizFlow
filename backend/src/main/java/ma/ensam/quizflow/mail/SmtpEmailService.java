package ma.ensam.quizflow.mail;

import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.EmailVerificationProperties;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class SmtpEmailService implements EmailService {
    private final JavaMailSender sender;
    private final EmailVerificationProperties properties;
    public SmtpEmailService(JavaMailSender sender, EmailVerificationProperties properties) {
        this.sender = sender; this.properties = properties;
    }
    @Override public void sendVerification(String recipient, String code, long validityMinutes) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from());
        message.setTo(recipient);
        message.setSubject("Confirmez votre inscription à QuizFlow");
        message.setText("Votre code de confirmation QuizFlow : " + code
                + "\n\nCe code est valable " + validityMinutes + " minutes. Ne le partagez avec personne."
                + "\nSi vous n'avez pas demandé cette inscription, ignorez cet email.");
        try {
            sender.send(message);
        } catch (MailException error) {
            // Do not propagate the SMTP exception: it can contain message contents and addresses.
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_DELIVERY_UNAVAILABLE",
                    "L’envoi est momentanément indisponible. Réessayez plus tard.");
        }
    }
}
