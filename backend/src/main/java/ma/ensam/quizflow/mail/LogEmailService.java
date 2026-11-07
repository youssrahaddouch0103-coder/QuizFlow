package ma.ensam.quizflow.mail;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Mode développement (app.mail.mode=log) : aucun email n'est envoyé, le code de confirmation
 * est écrit dans les logs du backend. Permet de lancer QuizFlow sans serveur SMTP
 * (développement, démo hors ligne). À ne jamais utiliser en production.
 */
@Service
@ConditionalOnProperty(prefix = "app.mail", name = "mode", havingValue = "log")
public class LogEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(LogEmailService.class);

    @PostConstruct
    void warn() {
        log.warn("MODE DEV : les emails ne sont pas envoyés, les codes s'affichent dans ces logs (app.mail.mode=log)");
    }

    @Override
    public void sendVerification(String recipient, String code, long validityMinutes) {
        log.warn("[MODE DEV] Code de confirmation pour {} : {} (valable {} min)", recipient, code, validityMinutes);
    }
}
