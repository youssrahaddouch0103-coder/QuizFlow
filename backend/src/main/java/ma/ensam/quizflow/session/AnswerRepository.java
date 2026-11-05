package ma.ensam.quizflow.session;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnswerRepository extends JpaRepository<Answer, UUID> {

    boolean existsByParticipantIdAndQuestionId(UUID participantId, String questionId);

    Optional<Answer> findByParticipantIdAndQuestionId(UUID participantId, String questionId);

    long countBySessionIdAndQuestionId(UUID sessionId, String questionId);

    List<Answer> findBySessionId(UUID sessionId);

    /** Répartition des choix pour une question : [choice_id, nombre]. */
    @Query(value = """
            select ac.choice_id, count(*)
            from answer_choices ac
            join answers a on a.id = ac.answer_id
            where a.session_id = :sessionId and a.question_id = :questionId
            group by ac.choice_id
            """, nativeQuery = true)
    List<Object[]> countChoices(@Param("sessionId") UUID sessionId, @Param("questionId") String questionId);
}
