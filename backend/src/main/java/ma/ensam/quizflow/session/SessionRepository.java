package ma.ensam.quizflow.session;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    /** Verrou exclusif (SELECT ... FOR UPDATE) : transitions d'état et clôture. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Session s where s.id = :id")
    Optional<Session> findByIdForUpdate(@Param("id") UUID id);

    /** Verrou partagé (SELECT ... FOR SHARE) : une réponse ne peut pas passer après la fermeture. */
    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select s from Session s where s.id = :id")
    Optional<Session> findByIdForShare(@Param("id") UUID id);

    @Query("select s from Session s where s.code = :code and s.state in :states")
    Optional<Session> findByCodeAndStateIn(@Param("code") String code,
                                           @Param("states") Collection<SessionState> states);

    boolean existsByCodeAndStateIn(String code, Collection<SessionState> states);

    List<Session> findByTeacherIdOrderByCreatedAtDesc(Long teacherId);

    List<Session> findByStateInAndLastActionAtBefore(Collection<SessionState> states, Instant before);

    /** Questions ouvertes dont le minuteur est écoulé. */
    @Query("select s.id from Session s where s.state = ma.ensam.quizflow.session.SessionState.QUESTION_OUVERTE "
            + "and s.questionDeadline is not null and s.questionDeadline <= :now")
    List<UUID> findExpiredQuestionSessionIds(@Param("now") Instant now);

    /** R1 : une activité est verrouillée dès qu'une session non annulée la référence. */
    @Query("select count(s) > 0 from Session s where s.activityId = :activityId "
            + "and s.state <> ma.ensam.quizflow.session.SessionState.ANNULEE")
    boolean existsActiveOrPlayedForActivity(@Param("activityId") String activityId);

    @Query("select distinct s.activityId from Session s where s.teacherId = :teacherId "
            + "and s.state <> ma.ensam.quizflow.session.SessionState.ANNULEE")
    List<String> findLockedActivityIds(@Param("teacherId") Long teacherId);
}
