package ma.ensam.quizflow.session;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Diffuse les statistiques en direct (ANSWER_STATS) à l'enseignant.
 * On attend que la réponse soit validée (COMMIT), on regroupe les demandes pendant un court instant,
 * puis on relit les chiffres depuis la base : le dernier message est toujours exact.
 */
@Component
public class LiveStatsBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(LiveStatsBroadcaster.class);
    private static final long DELAY_MS = 150;

    private final Set<UUID> pending = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "live-stats");
        t.setDaemon(true);
        return t;
    });
    private final SessionService sessionService;

    public LiveStatsBroadcaster(@Lazy SessionService sessionService) {
        this.sessionService = sessionService;
    }

    /** À appeler pendant la transaction qui enregistre une réponse : la diffusion part après le COMMIT. */
    public void requestAfterCommit(UUID sessionId) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    request(sessionId);
                }
            });
        } else {
            request(sessionId);
        }
    }

    private void request(UUID sessionId) {
        if (pending.add(sessionId)) {
            executor.schedule(() -> flush(sessionId), DELAY_MS, TimeUnit.MILLISECONDS);
        }
    }

    private void flush(UUID sessionId) {
        // Retiré AVANT le calcul : une réponse validée pendant le calcul déclenchera un nouvel envoi.
        pending.remove(sessionId);
        try {
            sessionService.publishLiveStats(sessionId);
        } catch (RuntimeException e) {
            log.warn("Statistiques en direct non envoyées pour la session {} : {}", sessionId, e.getMessage());
        }
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }
}