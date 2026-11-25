package ma.ensam.quizflow.session;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;

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

    /**
     * Réponse d'un étudiant. Choix : choiceIds. Classement : choiceIds dans l'ordre choisi.
     * Nuage de mots et texte libre : text. Note : value (1 à 5).
     */
    public record AnswerRequest(@NotBlank String questionId, List<String> choiceIds,
                                @Size(max = 500) String text, Integer value) {}

    /** Modération par l'enseignant : chaque champ absent reste inchangé. */
    public record ModerationRequest(Boolean done, Boolean hidden) {}

    /** Question du public ou idée publiée par un étudiant. */
    public record ContributionRequest(@NotBlank String questionId,
                                      @NotBlank @Size(max = 300, message = "300 caractères maximum") String text) {}

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

    public record QuestionLive(String id, int index, int total, String text, QuestionKind kind, ChoiceMode choiceMode,
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
            return new QuestionLive(q.getId(), index, total, q.getText(), q.getKind(), q.getChoiceMode(),
                    q.getChoices().stream().map(c -> new ChoiceLive(c.getId(), c.getLabel())).toList(),
                    duration, remaining);
        }
    }

    /** Envoyé à la fermeture d'une question : bonne(s) réponse(s) et répartition. */
    public record ClosedInfo(String questionId, List<String> correctChoiceIds, Map<String, Long> distribution,
                             long answerCount) {}

    /** Un mot du nuage et le nombre d'étudiants qui l'ont proposé. */
    public record WordCount(String text, long count) {}

    /** Note : moyenne (null sans réponse) et nombre de réponses pour chaque valeur de 1 à 5. */
    public record RatingStats(Double average, Map<Integer, Long> distribution) {}

    /** Classement : position moyenne d'un élément (1 = premier ; null s'il n'a pas encore été classé). */
    public record RankItem(String choiceId, String label, Double averagePosition) {}

    /** Question du public ou idée, avec son nombre de votes. Jamais le pseudo de l'auteur : c'est anonyme. */
    public record ContributionView(String id, String text, int votes, boolean done, boolean hidden) {}

    /** Résultats figés propres au type de la question (enregistrés en JSON à la fin de la séance). */
    public record QuestionDetails(List<WordCount> words, List<String> texts, RatingStats rating,
                                  List<RankItem> ranking, List<ContributionView> contributions) {}

    /** Contributions visibles par tous (envoyées aux téléphones pour qu'ils puissent voter). */
    public record ContributionsUpdate(String questionId, List<ContributionView> contributions) {}

    /**
     * Statistiques en direct pour l'enseignant. Selon le type de la question, seuls certains champs sont remplis :
     * distribution (choix), words (nuage), texts (texte libre), rating (note), ranking (classement),
     * contributions (questions du public, idées).
     */
    public record LiveStats(String questionId, QuestionKind kind, long answerCount, long participantCount,
                            Map<String, Long> distribution, List<WordCount> words, List<String> texts,
                            RatingStats rating, List<RankItem> ranking, List<ContributionView> contributions) {}

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

    public record QuestionResult(String id, int position, String text, QuestionKind kind, ChoiceMode choiceMode,
                                 int answerCount, Double successRate, List<ChoiceResult> choices,
                                 List<WordCount> words, List<String> texts, RatingStats rating,
                                 List<RankItem> ranking, List<ContributionView> contributions) {}

    public record ResultsView(SessionSummary session, List<LeaderboardEntry> leaderboard,
                              List<QuestionResult> questions) {}

    // ---------- Vues étudiant ----------

    public record PublicSessionInfo(String code, String title, ActivityType type, SessionState state) {}

    public record JoinResponse(UUID participantId, String pseudo, String token) {}

    public record MyResult(int score, int rank, long participantCount, int questionCount) {}

    /** Tout ce dont l'écran étudiant a besoin pour se (re)synchroniser. */
    public record PlayerState(String code, String title, ActivityType type, SessionState state, String pseudo,
                              QuestionLive question, boolean answered, List<String> myChoiceIds,
                              ClosedInfo closed, Boolean myAnswerCorrect, MyResult result,
                              String myText, Integer myValue, List<ContributionView> contributions,
                              List<String> myVotes, List<String> myContributions) {}
}
