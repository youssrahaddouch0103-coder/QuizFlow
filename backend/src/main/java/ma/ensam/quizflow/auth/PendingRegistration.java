package ma.ensam.quizflow.auth;

import java.time.Instant;
import java.util.UUID;

/** Projection JDBC, distincte des comptes actifs JPA. Ne pas journaliser ses données. */
public record PendingRegistration(UUID id, String email, String passwordHash, String displayName,
        byte[] codeMac, int codeVersion, int failedAttempts, Instant expiresAt,
        Instant resendAvailableAt, Instant createdAt) {
    @Override public String toString() { return "PendingRegistration[confidentiel]"; }
}
