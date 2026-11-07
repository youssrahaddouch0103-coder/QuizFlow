package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.config.EmailVerificationProperties;
import org.junit.jupiter.api.Test;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class VerificationCodeServiceTest {
    static EmailVerificationProperties properties() {
        return new EmailVerificationProperties(Base64.getEncoder().encodeToString(new byte[32]),
                "test@example.org", Duration.ofMinutes(10), Duration.ofSeconds(60), Duration.ofHours(24), 5, 5, 60);
    }

    @Test void codeIsSixDigitsAndMacIsBoundToChallengeAndVersion() {
        var service = new VerificationCodeService(properties());
        UUID id = UUID.randomUUID();
        for (int i = 0; i < 100; i++) assertThat(service.generate()).matches("[0-9]{6}");
        byte[] hash = service.fingerprint(id, 1, "000123");
        assertThat(hash).hasSize(32).isNotEqualTo(service.fingerprint(id, 2, "000123"));
        assertThat(hash).isNotEqualTo(service.fingerprint(UUID.randomUUID(), 1, "000123"));
        var pending = new PendingRegistration(id, "user@example.org", "hash", "Nom", hash, 1, 0,
                Instant.now(), Instant.now(), Instant.now());
        assertThat(service.matches(pending, "000123")).isTrue();
        assertThat(service.matches(pending, "000124")).isFalse();
        assertThat(pending.toString()).doesNotContain("user@example.org", "hash");
    }

    @Test void missingKeyFailsClosedWithoutEchoingSecret() {
        var p = properties();
        var invalid = new EmailVerificationProperties("bad-secret", p.from(), p.codeTtl(), p.resendDelay(),
                p.retention(), p.maxAttempts(), p.emailRequestsPerHour(), p.ipRequestsPerMinute());
        assertThatThrownBy(() -> new VerificationCodeService(invalid))
                .isInstanceOf(IllegalStateException.class).hasMessageNotContaining("bad-secret");
        assertThat(invalid.toString()).doesNotContain("bad-secret");
    }
}
