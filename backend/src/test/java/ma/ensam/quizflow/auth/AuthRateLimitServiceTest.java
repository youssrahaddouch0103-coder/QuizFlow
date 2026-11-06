package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Clock;
import java.time.Duration;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthRateLimitServiceTest {
    @Test void exceededQuotaIsCommittedBeforeErrorAndUsesRequiresNew() {
        var repo = mock(AuthRateLimitRepository.class);
        var manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(repo.increment(anyString(), any(), any())).thenReturn(6);
        var service = new AuthRateLimitService(repo, new VerificationCodeService(VerificationCodeServiceTest.properties()), Clock.systemUTC(), manager);
        assertThatThrownBy(() -> service.consume("email", "user@example.org", 5, Duration.ofHours(1)))
                .isInstanceOf(ApiException.class);
        verify(manager).getTransaction(argThat(t -> t.getPropagationBehavior() == TransactionDefinition.PROPAGATION_REQUIRES_NEW));
        verify(manager).commit(any());
        verify(manager, never()).rollback(any());
        verify(repo).increment(argThat(key -> !key.contains("user@example.org") && key.length() == 64), any(), any());
    }
}
