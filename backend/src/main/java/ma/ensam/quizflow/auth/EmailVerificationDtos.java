package ma.ensam.quizflow.auth;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.UUID;

public final class EmailVerificationDtos {
    private EmailVerificationDtos() {}

    public record PendingRegistrationResponse(UUID challengeId, Instant expiresAt,
            Instant resendAvailableAt, String message) {}

    public record VerifyRequest(
            @NotNull(message = "Recommencez votre inscription.") UUID challengeId,
            @NotNull(message = "Saisissez le code reçu par email.")
            @Pattern(regexp = "[0-9]{6}", message = "Saisissez un code à 6 chiffres.") String code) {
        @Override public String toString() { return "VerifyRequest[confidentiel]"; }
    }

    public record ResendRequest(
            @NotNull(message = "Recommencez votre inscription.") UUID challengeId) {}
}
