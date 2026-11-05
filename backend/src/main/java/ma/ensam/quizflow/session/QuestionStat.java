package ma.ensam.quizflow.session;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/** Statistiques figées d'une question à la clôture de la session (W6). */
@Entity
@Table(name = "question_stats")
@IdClass(QuestionStat.Key.class)
public class QuestionStat {

    @Id
    @Column(name = "session_id")
    private UUID sessionId;

    @Id
    @Column(name = "question_id")
    private String questionId;

    @Column(nullable = false)
    private int position;

    @Column(name = "answer_count", nullable = false)
    private int answerCount;

    /** Taux de bonnes réponses entre 0 et 1 ; null pour un sondage. */
    @Column(name = "success_rate")
    private Double successRate;

    /**
     * choiceId -> nombre de fois où le choix a été sélectionné (colonne JSONB).
     * Type Number : à la relecture, Jackson peut produire des Integer ou des Long.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Number> distribution = new HashMap<>();

    protected QuestionStat() {
    }

    public QuestionStat(UUID sessionId, String questionId, int position, int answerCount, Double successRate,
                        Map<String, Long> distribution) {
        this.sessionId = sessionId;
        this.questionId = questionId;
        this.position = position;
        this.answerCount = answerCount;
        this.successRate = successRate;
        this.distribution = new HashMap<>(distribution);
    }

    public UUID getSessionId() { return sessionId; }
    public String getQuestionId() { return questionId; }
    public int getPosition() { return position; }
    public int getAnswerCount() { return answerCount; }
    public Double getSuccessRate() { return successRate; }
    public Map<String, Number> getDistribution() { return distribution; }

    /** Nombre de sélections d'un choix (0 s'il n'a jamais été choisi). */
    public long count(String choiceId) {
        Number n = distribution.get(choiceId);
        return n == null ? 0L : n.longValue();
    }

    public static class Key implements Serializable {
        private UUID sessionId;
        private String questionId;

        public Key() {
        }

        public Key(UUID sessionId, String questionId) {
            this.sessionId = sessionId;
            this.questionId = questionId;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key key)) return false;
            return Objects.equals(sessionId, key.sessionId) && Objects.equals(questionId, key.questionId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(sessionId, questionId);
        }
    }
}
