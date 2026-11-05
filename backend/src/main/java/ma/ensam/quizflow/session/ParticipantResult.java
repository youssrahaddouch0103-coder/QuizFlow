package ma.ensam.quizflow.session;

import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "participant_results")
public class ParticipantResult {

    @Id
    @Column(name = "participant_id")
    private UUID participantId;

    @Column(nullable = false)
    private int score;

    @Column(name = "rank", nullable = false)
    private int rank;

    protected ParticipantResult() {
    }

    public ParticipantResult(UUID participantId, int score, int rank) {
        this.participantId = participantId;
        this.score = score;
        this.rank = rank;
    }

    public UUID getParticipantId() { return participantId; }
    public int getScore() { return score; }
    public int getRank() { return rank; }
}
