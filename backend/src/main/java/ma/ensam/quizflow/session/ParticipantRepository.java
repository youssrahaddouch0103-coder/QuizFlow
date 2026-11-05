package ma.ensam.quizflow.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ParticipantRepository extends JpaRepository<Participant, UUID> {

    Optional<Participant> findByTokenHash(String tokenHash);

    @Query("select count(p) > 0 from Participant p where p.sessionId = :sessionId "
            + "and lower(p.pseudo) = lower(:pseudo)")
    boolean existsPseudo(@Param("sessionId") UUID sessionId, @Param("pseudo") String pseudo);

    long countBySessionId(UUID sessionId);

    List<Participant> findBySessionIdOrderByJoinedAtAsc(UUID sessionId);
}
