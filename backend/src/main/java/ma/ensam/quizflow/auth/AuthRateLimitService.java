package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Clock;
import java.time.Duration;

@Service
public class AuthRateLimitService {
    private final AuthRateLimitRepository repository;
    private final VerificationCodeService codes;
    private final Clock clock;
    private final TransactionTemplate transaction;

    public AuthRateLimitService(AuthRateLimitRepository repository, VerificationCodeService codes,
            Clock clock, PlatformTransactionManager manager) {
        this.repository = repository;
        this.codes = codes;
        this.clock = clock;
        transaction = new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public void consume(String purpose, String value, int maximum, Duration window) {
        var now = clock.instant();
        int count = transaction.execute(status -> repository.increment(codes.bucket(purpose, value), now, now.plus(window)));
        if (count > maximum) throw limited();
    }

    public static ApiException limited() {
        return new ApiException(HttpStatus.TOO_MANY_REQUESTS, "VERIFICATION_RATE_LIMITED",
                "Trop de tentatives. Réessayez plus tard.");
    }
}
