package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import ma.ensam.quizflow.auth.AuthDtos.RegisterRequest;
import ma.ensam.quizflow.auth.AuthDtos.TeacherView;
import ma.ensam.quizflow.auth.EmailVerificationDtos.PendingRegistrationResponse;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.EmailVerificationProperties;
import ma.ensam.quizflow.mail.EmailService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class EmailVerificationService {
    private static final String MESSAGE = "Vérifiez votre boîte mail pour confirmer votre inscription.";
    private final PendingRegistrationRepository pending;
    private final VerifiedAccountEmailRepository verified;
    private final TeacherRepository teachers;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final VerificationCodeService codes;
    private final AuthRateLimitService limits;
    private final EmailService mail;
    private final EmailVerificationProperties properties;
    private final Clock clock;
    private final TransactionTemplate transaction;

    public EmailVerificationService(PendingRegistrationRepository pending, VerifiedAccountEmailRepository verified,
            TeacherRepository teachers, PasswordEncoder encoder, JwtService jwt, VerificationCodeService codes,
            AuthRateLimitService limits, EmailService mail, EmailVerificationProperties properties,
            Clock clock, PlatformTransactionManager manager) {
        this.pending = pending; this.verified = verified; this.teachers = teachers; this.encoder = encoder;
        this.jwt = jwt; this.codes = codes; this.limits = limits; this.mail = mail;
        this.properties = properties; this.clock = clock;
        transaction = new TransactionTemplate(manager);
    }

    public PendingRegistrationResponse start(RegisterRequest request) {
        String email = request.email().strip().toLowerCase(Locale.ROOT);
        if (request.password().getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.badRequest("VALIDATION_ERROR",
                    "Le mot de passe est trop long. Choisissez un mot de passe plus court.");
        }
        limits.consume("email-send", email, properties.emailRequestsPerHour(), Duration.ofHours(1));
        // Pay the same BCrypt cost for existing and new addresses.
        String passwordHash = encoder.encode(request.password());
        return transaction.execute(status -> {
            pending.lockEmail(codes.bucket("email-lock", email));
            Instant now = clock.instant();
            UUID id = UUID.randomUUID();
            var existing = pending.findByEmail(email);
            if (existing.isPresent() && expiredRegistration(existing.get(), now)) {
                pending.delete(existing.get().id());
                existing = java.util.Optional.empty();
            }
            // Never disclose an existing challenge or overwrite its password/name.
            if (teachers.findByEmailIgnoreCase(email).isPresent() || existing.isPresent()) {
                return response(id, now);
            }
            String code = codes.generate();
            var registration = new PendingRegistration(id, email, passwordHash, request.displayName().strip(),
                    codes.fingerprint(id, 1, code), 1, 0, now.plus(properties.codeTtl()),
                    now.plus(properties.resendDelay()), now);
            pending.insert(registration, now);
            // Bounded SMTP call in this transaction: failure leaves no unusable pending registration.
            // If SMTP accepts but the DB commit fails, the received code is harmless and cannot activate a user.
            mail.sendVerification(email, code, properties.codeTtl().toMinutes());
            return response(id, now);
        });
    }

    public PendingRegistrationResponse resend(UUID id) {
        limits.consume("challenge-send", id.toString(), properties.emailRequestsPerHour(), Duration.ofHours(1));
        var snapshot = pending.find(id);
        if (snapshot.isEmpty()) return response(id, clock.instant());
        limits.consume("email-send", snapshot.get().email(), properties.emailRequestsPerHour(), Duration.ofHours(1));
        return transaction.execute(status -> {
            pending.lockEmail(codes.bucket("email-lock", snapshot.get().email()));
            var current = pending.findLocked(id);
            Instant now = clock.instant();
            if (current.isEmpty() || expiredRegistration(current.get(), now)) return response(id, now);
            var registration = current.get();
            if (now.isBefore(registration.resendAvailableAt())) {
                throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "VERIFICATION_RESEND_TOO_SOON",
                        "Patientez avant de demander un nouveau code.");
            }
            int version = registration.codeVersion() + 1;
            String code;
            do {
                code = codes.generate();
            } while (codes.matches(registration, code));
            pending.replaceCode(id, codes.fingerprint(id, version, code), version,
                    now.plus(properties.codeTtl()), now.plus(properties.resendDelay()), now);
            mail.sendVerification(registration.email(), code, properties.codeTtl().toMinutes());
            return response(id, now);
        });
    }

    public AuthResponse verify(UUID id, String code) {
        limits.consume("challenge-verify", id.toString(), properties.maxAttempts() * properties.emailRequestsPerHour(), Duration.ofHours(1));
        var snapshot = pending.find(id);
        if (snapshot.isEmpty()) throw invalidCode();
        limits.consume("email-verify", snapshot.get().email(), properties.maxAttempts() * properties.emailRequestsPerHour(), Duration.ofHours(1));
        VerificationOutcome outcome = transaction.execute(status -> {
            pending.lockEmail(codes.bucket("email-lock", snapshot.get().email()));
            var current = pending.findLocked(id);
            Instant now = clock.instant();
            if (current.isEmpty()) return VerificationOutcome.invalid();
            var registration = current.get();
            if (expiredRegistration(registration, now) || !now.isBefore(registration.expiresAt())) {
                return VerificationOutcome.invalid();
            }
            if (registration.failedAttempts() >= properties.maxAttempts()) return new VerificationOutcome(null, true);
            if (!codes.matches(registration, code)) {
                pending.failedAttempt(id, now);
                return VerificationOutcome.invalid();
            }
            if (teachers.findByEmailIgnoreCase(registration.email()).isPresent()) {
                pending.delete(id);
                return VerificationOutcome.invalid();
            }
            Teacher teacher = teachers.saveAndFlush(new Teacher(registration.email(), registration.passwordHash(), registration.displayName()));
            verified.insert(teacher.getId(), now);
            pending.delete(id);
            return new VerificationOutcome(new AuthResponse(jwt.generate(teacher), TeacherView.of(teacher)), false);
        });
        // Throw only AFTER commit so wrong-code counters are not rolled back.
        if (outcome.limited()) throw AuthRateLimitService.limited();
        if (outcome.response() == null) throw invalidCode();
        return outcome.response();
    }

    private boolean expiredRegistration(PendingRegistration p, Instant now) {
        return !now.isBefore(p.createdAt().plus(properties.retention()));
    }
    private PendingRegistrationResponse response(UUID id, Instant now) {
        return new PendingRegistrationResponse(id, now.plus(properties.codeTtl()), now.plus(properties.resendDelay()), MESSAGE);
    }
    private static ApiException invalidCode() {
        return ApiException.badRequest("INVALID_VERIFICATION_CODE", "Ce code est incorrect ou a expiré.");
    }
    private record VerificationOutcome(AuthResponse response, boolean limited) {
        static VerificationOutcome invalid() { return new VerificationOutcome(null, false); }
    }
}
