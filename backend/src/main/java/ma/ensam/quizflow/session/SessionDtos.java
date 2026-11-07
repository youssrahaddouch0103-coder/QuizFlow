package ma.ensam.quizflow.session;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Objets échangés avec le frontend (REST et WebSocket). Voir docs/CONTRAT.md. */
public final class SessionDtos {

    private SessionDtos() {
    }

    // ---------- Requêtes ----------

    public record LaunchRequest(@NotBlank String activityId) {}

    public record JoinRequest(@NotBlank @Size(max = 30, message = "30 caractères maximum") String pseudo) {}

    public record AnswerRequest(@NotBlank String questionId, @NotEmpty List<String> choiceIds) {}

    // ---------- Question en direct (jamais de bonne réponse tant qu'elle est ouverte) ----------

    public record ChoiceLive(String id, String label) {}

    /**
     * Question en cours. durationSeconds : minuteur choisi (null = sans minuteur) ;
     * remainingMs : temps restant au moment de l'envoi (le client compte à partir de la réception,
     * ce qui évite les écarts d'horloge entre le serveur et les téléphones).
     */
    /** Corps facultatif de « démarrer » et « question suivante » : minuteur en secondes (absent = sans minuteur). */
    public record TimerRequest(@Min(value = 5, message = "5 secondes minimum")
                               @Max(value = 600, message = "10 minutes maximum") Integer durationSeconds) {}

    public record QuestionLive(String id, int index, int total, String text, ChoiceMode choiceMode,
                               List<ChoiceLive> choices, Integer durationSeconds, Long remainingMs) {

        public static QuestionLive of(Activity.Question q, int index, int total) {
            return of(q, index, total, null);
        }

        public static QuestionLive of(Activity.Question q, int index, int total, Session session) {
            Integer duration = session == null ? null : session.getQuestionDurationSeconds();
            Long remaining = null;
            if (session != null && session.getQuestionDeadline() != null
                    && session.getState() == SessionState.QUESTION_OUVERTE) {
                remaining = Math.max(0L, Duration.between(Instant.now(), session.getQuestionDeadline()).toMillis());
            }
            return new QuestionLive(q.getId(), index, total, q.getText(), q.getChoiceMode(),
                    q.getChoices().stream().map(c -> new ChoiceLive(c.getId(), c.getLabel())).toList(),
                    duration, remaining);
        }
    }

    /** Envoyé à la fermeture d'une question : bonne(s) réponse(s) et répartition. */
    public record ClosedInfo(String questionId, List<String> correctChoiceIds, Map<String, Long> distribution,
                             long answerCount) {}

    /** Statistiques en direct pour l'enseignant. */
    public record LiveStats(String questionId, long answerCount, long participantCount,
                            Map<String, Long> distribution) {}

    public record ParticipantJoined(String pseudo, long participantCount) {}

    // ---------- Vues enseignant ----------

    public record SessionSummary(UUID id, String code, SessionState state, String activityId, String activityTitle,
                                 ActivityType activityType, int questionCount, long participantCount,
                                 Instant createdAt, Instant endedAt) {}

    public record TeacherSessionView(UUID id, String code, SessionState state, String activityId,
                                     String activityTitle, ActivityType activityType, int questionCount,
                                     Integer currentIndex, QuestionLive currentQuestion, ClosedInfo closed,
                                     LiveStats stats, long participantCount, List<String> participants,
                                     Instant createdAt, Instant startedAt, Instant endedAt) {}

    public record LeaderboardEntry(String pseudo, int score, int rank) {}

    public record ChoiceResult(String id, String label, boolean correct, long count, double percent) {}

    public record QuestionResult(String id, int position, String text, ChoiceMode choiceMode, int answerCount,
                                 Double successRate, List<ChoiceResult> choices) {}

    public record ResultsView(SessionSummary session, List<LeaderboardEntry> leaderboard,
                              List<QuestionResult> questions) {}

    // ---------- Vues étudiant ----------

    public record PublicSessionInfo(String code, String title, ActivityType type, SessionState state) {}

    public record JoinResponse(UUID participantId, String pseudo, String token) {}

    public record MyResult(int score, int rank, long participantCount, int questionCount) {}

    /** Tout ce dont l'écran étudiant a besoin pour se (re)synchroniser. */
    public record PlayerState(String code, String title, ActivityType type, SessionState state, String pseudo,
                              QuestionLive question, boolean answered, List<String> myChoiceIds,
                              ClosedInfo closed, Boolean myAnswerCorrect, MyResult result) {}
}
