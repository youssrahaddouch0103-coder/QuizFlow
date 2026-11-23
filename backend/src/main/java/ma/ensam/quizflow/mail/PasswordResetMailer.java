package ma.ensam.quizflow.mail;

import ma.ensam.quizflow.config.EmailVerificationProperties;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Component;

@Component
public class PasswordResetMailer {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetMailer.class);

    /** Absent en mode développement (app.mail.mode=log) : les messages vont alors dans les logs. */
    private final JavaMailSender sender;
    private final EmailVerificationProperties properties;
    private final ThreadPoolTaskExecutor executor;

    public PasswordResetMailer(@Qualifier("verificationMailSender") ObjectProvider<JavaMailSender> sender,
                               EmailVerificationProperties properties) {
        this.sender = sender.getIfAvailable();
        this.properties = properties;
        this.executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(2);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("password-reset-");
        executor.initialize();
    }

    public void enqueue(Runnable task) {
        executor.execute(task);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdown();
    }

    public void sendCode(String recipient, String code, long validityMinutes) {
        send(recipient, "QuizFlow — Réinitialisation du mot de passe",
                "Votre code de réinitialisation QuizFlow : " + code
                        + "\n\nCe code expire dans " + validityMinutes + " minutes. Gardez-le pour vous."
                        + "\nSi vous n’avez pas demandé ce code, vous pouvez ignorer ce message.");
    }

    public void sendConfirmation(String recipient) {
        send(recipient, "QuizFlow — Mot de passe modifié",
                "Le mot de passe de votre compte QuizFlow a été modifié."
                        + "\nSi vous n’êtes pas à l’origine de ce changement, réinitialisez votre mot de passe depuis QuizFlow.");
    }

    private void send(String recipient, String subject, String text) {
        if (sender == null) {
            log.warn("[MODE DEV] Email pour {} — {} :\n{}", recipient, subject, text);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from());
        message.setTo(recipient);
        message.setSubject(subject);
        message.setText(text);
        sender.send(message);
    }
}
