package ma.ensam.quizflow.session;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "participants")
public class Participant {

    @Id
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(nullable = false, length = 30)
    private String pseudo;

    /** Empreinte SHA-256 du jeton : le jeton lui-même n'est connu que du navigateur de l'étudiant. */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "joined_at", nullable = false)
    private Instant joinedAt;

    protected Participant() {
    }

    public Participant(UUID sessionId, String pseudo, String tokenHash) {
        this.id = UUID.randomUUID();
        this.sessionId = sessionId;
        this.pseudo = pseudo;
        this.tokenHash = tokenHash;
        this.joinedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getSessionId() { return sessionId; }
    public String getPseudo() { return pseudo; }
    public String getTokenHash() { return tokenHash; }
    public Instant getJoinedAt() { return joinedAt; }
}
