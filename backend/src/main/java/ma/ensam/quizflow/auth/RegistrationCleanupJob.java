package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.config.EmailVerificationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;

@Component
public class RegistrationCleanupJob {
    private final PendingRegistrationRepository pending;
    private final AuthRateLimitRepository limits;
    private final EmailVerificationProperties properties;
    private final Clock clock;
    public RegistrationCleanupJob(PendingRegistrationRepository pending, AuthRateLimitRepository limits,
            EmailVerificationProperties properties, Clock clock) {
        this.pending = pending; this.limits = limits; this.properties = properties; this.clock = clock;
    }
    @Scheduled(fixedDelayString = "${app.email-verification.cleanup-delay-ms:3600000}")
    @Transactional
    public void cleanup() {
        var now = clock.instant();
        pending.deleteCreatedBefore(now.minus(properties.retention()));
        limits.deleteExpired(now);
    }
}
