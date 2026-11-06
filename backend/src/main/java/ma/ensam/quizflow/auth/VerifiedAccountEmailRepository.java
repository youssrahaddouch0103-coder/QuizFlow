package ma.ensam.quizflow.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;

@Repository
public class VerifiedAccountEmailRepository {
    private final JdbcTemplate jdbc;
    public VerifiedAccountEmailRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public void insert(long teacherId, Instant at) {
        jdbc.update("INSERT INTO verified_account_emails (teacher_id, verified_at) VALUES (?,?)",
                teacherId, Timestamp.from(at));
    }
}
