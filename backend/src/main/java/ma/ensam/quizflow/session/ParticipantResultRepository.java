package ma.ensam.quizflow.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ParticipantResultRepository extends JpaRepository<ParticipantResult, UUID> {

    List<ParticipantResult> findByParticipantIdIn(Collection<UUID> participantIds);
}
