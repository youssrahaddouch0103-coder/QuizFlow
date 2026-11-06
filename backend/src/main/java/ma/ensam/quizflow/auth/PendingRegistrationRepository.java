package ma.ensam.quizflow.auth;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public class PendingRegistrationRepository {
    private final JdbcTemplate jdbc;
    private static final RowMapper<PendingRegistration> MAPPER = (rs, row) -> new PendingRegistration(
            rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("password_hash"),
            rs.getString("display_name"), rs.getBytes("code_mac"), rs.getInt("code_version"),
            rs.getInt("failed_attempts"), rs.getTimestamp("expires_at").toInstant(),
            rs.getTimestamp("resend_available_at").toInstant(), rs.getTimestamp("created_at").toInstant());

    public PendingRegistrationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void lockEmail(String key) {
        // Transaction-scoped advisory lock also serializes requests before a row exists.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", rs -> {}, key);
    }

    public Optional<PendingRegistration> find(UUID id) {
        return jdbc.query("SELECT * FROM pending_registrations WHERE id = ?", MAPPER, id).stream().findFirst();
    }

    public Optional<PendingRegistration> findLocked(UUID id) {
        return jdbc.query("SELECT * FROM pending_registrations WHERE id = ? FOR UPDATE", MAPPER, id).stream().findFirst();
    }

    public Optional<PendingRegistration> findByEmail(String email) {
        return jdbc.query("SELECT * FROM pending_registrations WHERE lower(email) = lower(?) FOR UPDATE", MAPPER, email)
                .stream().findFirst();
    }

    public void insert(PendingRegistration p, Instant now) {
        jdbc.update("""
                INSERT INTO pending_registrations
                (id,email,password_hash,display_name,code_mac,code_version,failed_attempts,
                 expires_at,resend_available_at,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """, p.id(), p.email(), p.passwordHash(), p.displayName(), p.codeMac(), p.codeVersion(),
                p.failedAttempts(), Timestamp.from(p.expiresAt()), Timestamp.from(p.resendAvailableAt()),
                Timestamp.from(p.createdAt()), Timestamp.from(now));
    }

    public void failedAttempt(UUID id, Instant now) {
        jdbc.update("UPDATE pending_registrations SET failed_attempts = failed_attempts + 1, updated_at = ? WHERE id = ?",
                Timestamp.from(now), id);
    }

    public void replaceCode(UUID id, byte[] mac, int version, Instant expiry, Instant resendAt, Instant now) {
        jdbc.update("""
                UPDATE pending_registrations SET code_mac = ?, code_version = ?, failed_attempts = 0,
                expires_at = ?, resend_available_at = ?, updated_at = ? WHERE id = ?
                """, mac, version, Timestamp.from(expiry), Timestamp.from(resendAt), Timestamp.from(now), id);
    }

    public void delete(UUID id) { jdbc.update("DELETE FROM pending_registrations WHERE id = ?", id); }

    public void deleteCreatedBefore(Instant cutoff) {
        jdbc.update("DELETE FROM pending_registrations WHERE created_at < ?", Timestamp.from(cutoff));
    }
}
