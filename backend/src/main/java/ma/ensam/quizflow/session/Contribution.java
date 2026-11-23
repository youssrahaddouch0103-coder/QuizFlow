package ma.ensam.quizflow.session;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Questions du public et idées : texte publié par un étudiant pendant qu'une question est ouverte.
 * Les autres étudiants votent pour les contributions qui les intéressent (un vote chacun).
 */
@Entity
@Table(name = "contributions")
public class Contribution {

    @Id
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "question_id", nullable = false)
    private String questionId;

    @Column(name = "participant_id", nullable = false)
    private UUID participantId;

    @Column(nullable = false, length = 300)
    private String text;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private boolean done;

    @Column(nullable = false)
    private boolean hidden;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "contribution_votes", joinColumns = @JoinColumn(name = "contribution_id"))
    @Column(name = "participant_id")
    private Set<UUID> voters = new HashSet<>();

    protected Contribution() {
    }

    public Contribution(UUID sessionId, String questionId, UUID participantId, String text) {
        this.id = UUID.randomUUID();
        this.sessionId = sessionId;
        this.questionId = questionId;
        this.participantId = participantId;
        this.text = text;
        this.createdAt = Instant.now();
    }

    /** Ajoute ou retire le vote d'un étudiant ; renvoie true si l'étudiant vote désormais pour cette contribution. */
    public boolean toggleVote(UUID participant) {
        if (voters.remove(participant)) {
            return false;
        }
        voters.add(participant);
        return true;
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getQuestionId() { return questionId; }
    public UUID getParticipantId() { return participantId; }
    public String getText() { return text; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isDone() { return done; }
    public void setDone(boolean done) { this.done = done; }
    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
    public Set<UUID> getVoters() { return voters; }
    public int getVotes() { return voters.size(); }
}
