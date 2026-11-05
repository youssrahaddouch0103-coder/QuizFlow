package ma.ensam.quizflow.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface TeacherRepository extends JpaRepository<Teacher, Long> {

    @Query("select t from Teacher t where lower(t.email) = lower(:email)")
    Optional<Teacher> findByEmailIgnoreCase(@Param("email") String email);
}
