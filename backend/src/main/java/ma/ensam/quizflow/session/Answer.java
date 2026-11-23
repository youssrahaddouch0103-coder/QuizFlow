package ma.ensam.quizflow.session;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "answers")
public class Answer {

    @Id
    private UUID id;

    @Column(name = "participant_id", nullable = false)
    private UUID participantId;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "question_id", nullable = false)
    private String questionId;

    /** null pour un sondage. */
    @Column(name = "is_correct")
    private Boolean correct;

    @Column(name = "answered_at", nullable = false)
    private Instant answeredAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "answer_choices", joinColumns = @JoinColumn(name = "answer_id"))
    @Column(name = "choice_id")
    private Set<String> choiceIds = new HashSet<>();

    /** Nuage de mots et texte libre : le texte saisi. Classement : les éléments dans l'ordre, séparés par des virgules. */
    @Column(name = "text_value", length = 500)
    private String textValue;

    /** Note : valeur de 1 à 5. */
    @Column(name = "number_value")
    private Integer numberValue;

    protected Answer() {
    }

    public Answer(UUID participantId, UUID sessionId, String questionId, Boolean correct, Set<String> choiceIds) {
        this(participantId, sessionId, questionId, correct, choiceIds, null, null);
    }

    public Answer(UUID participantId, UUID sessionId, String questionId, Boolean correct, Set<String> choiceIds,
                  String textValue, Integer numberValue) {
        this.id = UUID.randomUUID();
        this.participantId = participantId;
        this.sessionId = sessionId;
        this.questionId = questionId;
        this.correct = correct;
        this.choiceIds = new HashSet<>(choiceIds);
        this.textValue = textValue;
        this.numberValue = numberValue;
        this.answeredAt = Instant.now();
    }

    /** Réponse texte (nuage de mots, texte libre). */
    public static Answer text(UUID participantId, UUID sessionId, String questionId, String text) {
        return new Answer(participantId, sessionId, questionId, null, Set.of(), text, null);
    }

    /** Note de 1 à 5. */
    public static Answer number(UUID participantId, UUID sessionId, String questionId, int value) {
        return new Answer(participantId, sessionId, questionId, null, Set.of(), null, value);
    }

    /** Classement : identifiants des éléments, du premier au dernier. */
    public static Answer ranking(UUID participantId, UUID sessionId, String questionId, List<String> order) {
        return new Answer(participantId, sessionId, questionId, null, Set.of(), String.join(",", order), null);
    }

    public UUID getId() { return id; }
    public UUID getParticipantId() { return participantId; }
    public UUID getSessionId() { return sessionId; }
    public String getQuestionId() { return questionId; }
    public Boolean getCorrect() { return correct; }
    public Instant getAnsweredAt() { return answeredAt; }
    public Set<String> getChoiceIds() { return choiceIds; }
    public String getTextValue() { return textValue; }
    public Integer getNumberValue() { return numberValue; }

    /** Classement : ordre choisi (liste vide pour les autres types). */
    public List<String> getRanking() {
        return textValue == null || textValue.isEmpty() ? List.of() : List.of(textValue.split(","));
    }
}
