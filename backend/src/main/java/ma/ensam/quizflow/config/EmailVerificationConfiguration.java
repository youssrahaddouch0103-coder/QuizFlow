package ma.ensam.quizflow.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.autoconfigure.mail.MailProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@Configuration
@EnableConfigurationProperties({EmailVerificationProperties.class, MailProperties.class})
public class EmailVerificationConfiguration {
    @Bean
    public Clock verificationClock() {
        return Clock.systemUTC();
    }

    @Bean
    public JavaMailSender verificationMailSender(MailProperties properties) {
        if (properties.getHost() == null || properties.getHost().isBlank()) {
            throw new IllegalStateException("Configurer le serveur SMTP pour la vérification email");
        }
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(properties.getHost());
        if (properties.getPort() != null) sender.setPort(properties.getPort());
        sender.setUsername(properties.getUsername());
        sender.setPassword(properties.getPassword());
        sender.setProtocol(properties.getProtocol());
        sender.setDefaultEncoding(properties.getDefaultEncoding().name());
        var settings = sender.getJavaMailProperties();
        settings.putAll(properties.getProperties());
        // Bound all network waits, including an SMTP server that accepts but stops responding.
        for (String protocol : new String[]{"smtp", "smtps"}) {
            settings.setProperty("mail." + protocol + ".connectiontimeout", "5000");
            settings.setProperty("mail." + protocol + ".timeout", "5000");
            settings.setProperty("mail." + protocol + ".writetimeout", "5000");
            settings.setProperty("mail." + protocol + ".ssl.checkserveridentity", "true");
        }
        settings.putIfAbsent("mail.smtp.auth", String.valueOf(properties.getUsername() != null));
        settings.putIfAbsent("mail.smtp.starttls.enable", "true");
        settings.putIfAbsent("mail.smtp.starttls.required", "true");
        // SMTP debug prints message bodies. Never enable it for confirmation codes.
        settings.setProperty("mail.debug", "false");
        settings.setProperty("mail.debug.auth", "false");
        return sender;
    }
}
