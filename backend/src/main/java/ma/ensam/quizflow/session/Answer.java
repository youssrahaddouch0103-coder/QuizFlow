package ma.ensam.quizflow.session;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.HashSet;
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

    protected Answer() {
    }

    public Answer(UUID participantId, UUID sessionId, String questionId, Boolean correct, Set<String> choiceIds) {
        this.id = UUID.randomUUID();
        this.participantId = participantId;
        this.sessionId = sessionId;
        this.questionId = questionId;
        this.correct = correct;
        this.choiceIds = new HashSet<>(choiceIds);
        this.answeredAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getParticipantId() { return participantId; }
    public UUID getSessionId() { return sessionId; }
    public String getQuestionId() { return questionId; }
    public Boolean getCorrect() { return correct; }
    public Instant getAnsweredAt() { return answeredAt; }
    public Set<String> getChoiceIds() { return choiceIds; }
}
