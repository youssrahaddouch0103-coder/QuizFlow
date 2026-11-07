package ma.ensam.quizflow.session;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Minuteur par question : ferme automatiquement une question dont le temps est écoulé, même si
 * l'écran de l'enseignant est en retard ou fermé. Les étudiants et l'écran projeté reçoivent
 * l'événement QUESTION_CLOSED comme pour une fermeture manuelle.
 */
@Component
public class QuestionTimerJob {

    private static final Logger log = LoggerFactory.getLogger(QuestionTimerJob.class);

    private final SessionRepository sessions;
    private final SessionService sessionService;

    public QuestionTimerJob(SessionRepository sessions, SessionService sessionService) {
        this.sessions = sessions;
        this.sessionService = sessionService;
    }

    @Scheduled(fixedDelay = 500, initialDelay = 2000)
    public void closeExpiredQuestions() {
        Instant now = Instant.now();
        for (UUID id : sessions.findExpiredQuestionSessionIds(now)) {
            try {
                if (sessionService.closeExpiredQuestion(id, now)) {
                    log.info("Question fermée automatiquement (minuteur écoulé) pour la session {}", id);
                }
            } catch (RuntimeException e) {
                log.warn("Fermeture automatique de la question impossible pour la session {} : {}", id, e.getMessage());
            }
        }
    }
}
