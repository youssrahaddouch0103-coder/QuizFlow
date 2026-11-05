package ma.ensam.quizflow.session;

import ma.ensam.quizflow.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * R7 : une session sans action de l'enseignant pendant 2 h est terminée automatiquement
 * (ou annulée si elle n'avait pas démarré). Même service que la clôture manuelle.
 */
@Component
public class SessionTimeoutJob {

    private static final Logger log = LoggerFactory.getLogger(SessionTimeoutJob.class);

    private final SessionRepository sessions;
    private final SessionService sessionService;
    private final Duration inactivity;

    public SessionTimeoutJob(SessionRepository sessions, SessionService sessionService, AppProperties props) {
        this.sessions = sessions;
        this.sessionService = sessionService;
        this.inactivity = Duration.ofMinutes(props.session().inactivityMinutes());
    }

    @Scheduled(fixedDelayString = "${app.session.timeout-check-ms}", initialDelayString = "${app.session.timeout-check-ms}")
    public void endAbandonedSessions() {
        Instant limit = Instant.now().minus(inactivity);
        for (Session s : sessions.findByStateInAndLastActionAtBefore(SessionState.ACTIVE, limit)) {
            try {
                if (s.getState() == SessionState.EN_ATTENTE) {
                    sessionService.cancelInternal(s.getId());
                } else {
                    sessionService.endInternal(s.getId());
                }
                log.info("Session {} ({}) fermée automatiquement après inactivité", s.getCode(), s.getId());
            } catch (RuntimeException e) {
                log.warn("Fermeture automatique impossible pour la session {} : {}", s.getId(), e.getMessage());
            }
        }
    }
}
