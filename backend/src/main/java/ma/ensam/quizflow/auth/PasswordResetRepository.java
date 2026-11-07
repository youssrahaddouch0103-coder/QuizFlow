package ma.ensam.quizflow.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PasswordResetRepository {
    record Account(long id, String email) {}
    record ResetCode(UUID nonce, String mac, Instant expiresAt) {}

    private final JdbcTemplate jdbc;

    public PasswordResetRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    Optional<Account> lockAccount(String email) {
        return jdbc.query("SELECT id, email FROM teachers WHERE lower(email) = ? FOR UPDATE",
                (rs, row) -> new Account(rs.getLong("id"), rs.getString("email")), email).stream().findFirst();
    }

    Optional<ResetCode> findCode(long teacherId) {
        return jdbc.query("SELECT nonce, code_mac, expires_at FROM password_reset_codes WHERE teacher_id = ?",
                (rs, row) -> new ResetCode(rs.getObject("nonce", UUID.class), rs.getString("code_mac"),
                        rs.getTimestamp("expires_at").toInstant()), teacherId).stream().findFirst();
    }

    void saveCode(long teacherId, ResetCode code) {
        jdbc.update("""
                INSERT INTO password_reset_codes (teacher_id, nonce, code_mac, expires_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (teacher_id) DO UPDATE
                SET nonce = EXCLUDED.nonce, code_mac = EXCLUDED.code_mac, expires_at = EXCLUDED.expires_at
                """, teacherId, code.nonce(), code.mac(), Timestamp.from(code.expiresAt()));
    }

    void replacePassword(long teacherId, String hash) {
        jdbc.update("UPDATE teachers SET password_hash = ?, auth_version = auth_version + 1 WHERE id = ?", hash, teacherId);
        jdbc.update("DELETE FROM password_reset_codes WHERE teacher_id = ?", teacherId);
    }
}
