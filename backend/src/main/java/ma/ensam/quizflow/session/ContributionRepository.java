package ma.ensam.quizflow.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ContributionRepository extends JpaRepository<Contribution, UUID> {

    List<Contribution> findBySessionIdAndQuestionId(UUID sessionId, String questionId);

    List<Contribution> findBySessionId(UUID sessionId);

    long countBySessionIdAndQuestionIdAndParticipantId(UUID sessionId, String questionId, UUID participantId);
}
