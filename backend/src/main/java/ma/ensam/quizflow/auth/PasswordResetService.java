package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.mail.PasswordResetMailer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;

@Service
public class PasswordResetService {
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);
    private static final Duration CODE_TTL = Duration.ofMinutes(10);

    private final PasswordResetRepository repository;
    private final PasswordEncoder encoder;
    private final VerificationCodeService codes;
    private final AuthRateLimitService limits;
    private final PasswordResetMailer mailer;
    private final Clock clock;
    private final TransactionTemplate transaction;

    public PasswordResetService(PasswordResetRepository repository, PasswordEncoder encoder,
            VerificationCodeService codes, AuthRateLimitService limits, PasswordResetMailer mailer,
            Clock clock, PlatformTransactionManager transactionManager) {
        this.repository = repository;
        this.encoder = encoder;
        this.codes = codes;
        this.limits = limits;
        this.mailer = mailer;
        this.clock = clock;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public void requestCode(String address, String ip) {
        String email = normalize(address);
        limits.consume("password-reset-request-ip", ip, 20, Duration.ofMinutes(1));
        limits.consume("password-reset-request-email", email, 3, Duration.ofHours(1));

        try {
            mailer.enqueue(() -> {
                try {
                    transaction.executeWithoutResult(status -> repository.lockAccount(email)
                            .ifPresent(this::issueCode));
                } catch (RuntimeException error) {
                    // SMTP errors may contain the recipient or the code.
                    log.warn("Échec du traitement d’une demande de réinitialisation ({})",
                            error.getClass().getSimpleName());
                }
            });
        } catch (TaskRejectedException error) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PASSWORD_RESET_UNAVAILABLE",
                    "Réessayez dans quelques instants.");
        }
    }

    private void issueCode(PasswordResetRepository.Account account) {
        var previous = repository.findCode(account.id());
        String code = codes.generate();
        while (previous.isPresent() && matches(account.id(), previous.get(), code)) {
            code = codes.generate();
        }
        UUID nonce = UUID.randomUUID();
        repository.saveCode(account.id(), new PasswordResetRepository.ResetCode(
                nonce, fingerprint(account.id(), nonce, code), clock.instant().plus(CODE_TTL)));
        mailer.sendCode(account.email(), code, CODE_TTL.toMinutes());
    }

    public void reset(String address, String code, String password, String ip) {
        String email = normalize(address);
        limits.consume("password-reset-attempt-ip", ip, 30, Duration.ofMinutes(1));
        limits.consume("password-reset-attempt-email", email, 5, CODE_TTL);
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.badRequest("VALIDATION_ERROR", "Choisissez un mot de passe plus court.");
        }

        String recipient = transaction.execute(status -> {
            var account = repository.lockAccount(email).orElseThrow(PasswordResetService::invalidCode);
            boolean valid = repository.findCode(account.id())
                    .filter(candidate -> clock.instant().isBefore(candidate.expiresAt()))
                    .filter(candidate -> matches(account.id(), candidate, code))
                    .isPresent();
            if (!valid) throw invalidCode();
            repository.replacePassword(account.id(), encoder.encode(password));
            return account.email();
        });
        try {
            mailer.enqueue(() -> {
                try {
                    mailer.sendConfirmation(recipient);
                } catch (RuntimeException error) {
                    log.warn("Échec de la notification de changement de mot de passe ({})",
                            error.getClass().getSimpleName());
                }
            });
        } catch (TaskRejectedException error) {
            log.warn("File d’envoi pleine après le changement de mot de passe");
        }
    }

    private String fingerprint(long teacherId, UUID nonce, String code) {
        return codes.bucket("password-reset-code", teacherId + ":" + nonce + ":" + code);
    }

    private boolean matches(long teacherId, PasswordResetRepository.ResetCode resetCode, String code) {
        String computed = fingerprint(teacherId, resetCode.nonce(), code);
        return MessageDigest.isEqual(resetCode.mac().getBytes(StandardCharsets.US_ASCII),
                computed.getBytes(StandardCharsets.US_ASCII));
    }

    private static String normalize(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }

    private static ApiException invalidCode() {
        return ApiException.badRequest("INVALID_PASSWORD_RESET_CODE",
                "Ce code est incorrect ou a expiré. Vérifiez-le ou demandez un nouveau code.");
    }
}
