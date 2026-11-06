package ma.ensam.quizflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

@ConfigurationProperties("app.email-verification")
public record EmailVerificationProperties(
        String hmacKey,
        String from,
        @DefaultValue("10m") Duration codeTtl,
        @DefaultValue("60s") Duration resendDelay,
        @DefaultValue("24h") Duration retention,
        @DefaultValue("5") int maxAttempts,
        @DefaultValue("5") int emailRequestsPerHour,
        @DefaultValue("60") int ipRequestsPerMinute) {
    public EmailVerificationProperties {
        if (from == null || !from.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) {
            throw new IllegalStateException("Configurer une adresse d'envoi email valide");
        }
        if (codeTtl == null || codeTtl.isNegative() || codeTtl.isZero()
                || resendDelay == null || resendDelay.isNegative() || resendDelay.isZero()
                || retention == null || retention.compareTo(codeTtl) < 0
                || maxAttempts < 1 || emailRequestsPerHour < 1 || ipRequestsPerMinute < 1) {
            throw new IllegalStateException("Configuration de vérification email invalide");
        }
    }
    @Override public String toString() { return "EmailVerificationProperties[confidentiel]"; }
}
