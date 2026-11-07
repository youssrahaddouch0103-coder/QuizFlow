package ma.ensam.quizflow.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;

@Repository
public class AuthRateLimitRepository {
    private final JdbcTemplate jdbc;
    public AuthRateLimitRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public int increment(String key, Instant now, Instant until) {
        return jdbc.queryForObject("""
                INSERT INTO auth_rate_limits (bucket_key, window_start, request_count, expires_at)
                VALUES (?, ?, 1, ?)
                ON CONFLICT (bucket_key) DO UPDATE SET
                  request_count = CASE WHEN auth_rate_limits.expires_at <= EXCLUDED.window_start
                    THEN 1 ELSE LEAST(auth_rate_limits.request_count, 1000000) + 1 END,
                  expires_at = CASE WHEN auth_rate_limits.expires_at <= EXCLUDED.window_start
                    THEN EXCLUDED.expires_at ELSE auth_rate_limits.expires_at END,
                  window_start = CASE WHEN auth_rate_limits.expires_at <= EXCLUDED.window_start
                    THEN EXCLUDED.window_start ELSE auth_rate_limits.window_start END
                RETURNING request_count
                """, Integer.class, key, Timestamp.from(now), Timestamp.from(until));
    }

    public void deleteExpired(Instant now) {
        jdbc.update("DELETE FROM auth_rate_limits WHERE expires_at < ?", Timestamp.from(now));
    }
}
