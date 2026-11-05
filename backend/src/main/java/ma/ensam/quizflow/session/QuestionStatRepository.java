package ma.ensam.quizflow.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QuestionStatRepository extends JpaRepository<QuestionStat, QuestionStat.Key> {

    List<QuestionStat> findBySessionIdOrderByPositionAsc(UUID sessionId);
}
