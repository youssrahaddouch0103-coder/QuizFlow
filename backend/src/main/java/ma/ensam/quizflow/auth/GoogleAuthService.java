package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import ma.ensam.quizflow.auth.AuthDtos.TeacherView;
import ma.ensam.quizflow.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

@Service
public class GoogleAuthService {
    static final Duration CHALLENGE_TTL = Duration.ofMinutes(5);

    private final JdbcTemplate jdbc;
    private final TeacherRepository teachers;
    private final PendingRegistrationRepository pending;
    private final VerifiedAccountEmailRepository verified;
    private final VerificationCodeService codes;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final Clock clock;

    public GoogleAuthService(JdbcTemplate jdbc, TeacherRepository teachers, PendingRegistrationRepository pending,
                             VerifiedAccountEmailRepository verified, VerificationCodeService codes,
                             PasswordEncoder passwords, JwtService jwt, Clock clock) {
        this.jdbc = jdbc;
        this.teachers = teachers;
        this.pending = pending;
        this.verified = verified;
        this.codes = codes;
        this.passwords = passwords;
        this.jwt = jwt;
        this.clock = clock;
    }

    @Transactional
    public Challenge issueChallenge() {
        var now = clock.instant();
        UUID nonce = UUID.randomUUID();
        String proof = UUID.randomUUID().toString();
        jdbc.update("DELETE FROM google_auth_challenges WHERE expires_at <= ?", Timestamp.from(now));
        jdbc.update("INSERT INTO google_auth_challenges (nonce, browser_proof, expires_at) VALUES (?, ?, ?)",
                nonce, proofHash(proof), Timestamp.from(now.plus(CHALLENGE_TTL)));
        return new Challenge(nonce, proof);
    }

    @Transactional
    public AuthResponse openSession(GoogleTokenVerifier.Identity identity, String browserProof) {
        if (browserProof == null || browserProof.length() != 36) throw GoogleTokenVerifier.invalidCredential();
        // The row lock serializes replays. A successful request deletes the challenge in the same transaction.
        boolean valid = jdbc.query("""
                SELECT nonce FROM google_auth_challenges
                WHERE nonce = ? AND browser_proof = ? AND expires_at > ? FOR UPDATE
                """, rs -> { return rs.next(); }, identity.nonce(), proofHash(browserProof), Timestamp.from(clock.instant()));
        if (!valid) throw GoogleTokenVerifier.invalidCredential();

        pending.lockEmail(codes.bucket("google-subject-lock", identity.subject()));
        var linked = jdbc.query("SELECT teacher_id FROM teacher_google_accounts WHERE google_subject = ?",
                (rs, row) -> rs.getLong(1), identity.subject()).stream().findFirst();
        Teacher teacher;
        if (linked.isPresent()) {
            teacher = teachers.findById(linked.get()).orElseThrow(GoogleTokenVerifier::invalidCredential);
        } else {
            pending.lockEmail(codes.bucket("email-lock", identity.email()));
            teacher = findOrCreate(identity);
            jdbc.update("INSERT INTO teacher_google_accounts (google_subject, teacher_id) VALUES (?, ?)",
                    identity.subject(), teacher.getId());
        }
        jdbc.update("DELETE FROM google_auth_challenges WHERE nonce = ?", identity.nonce());
        return new AuthResponse(jwt.generate(teacher), TeacherView.of(teacher));
    }

    private Teacher findOrCreate(GoogleTokenVerifier.Identity identity) {
        // Google is authoritative for verified Gmail and Workspace addresses.
        // A verified third-party address alone cannot establish current mailbox ownership.
        if (!identity.hostedEmail()) {
            throw ApiException.badRequest("GOOGLE_EMAIL_UNSUPPORTED",
                    "Utilisez la connexion par email pour cette adresse, ou choisissez un compte Gmail ou Google Workspace.");
        }
        var existing = jdbc.query("SELECT id FROM teachers WHERE lower(email) = ? FOR UPDATE",
                (rs, row) -> rs.getLong(1), identity.email()).stream().findFirst();
        if (existing.isPresent()) {
            Teacher teacher = teachers.findById(existing.get()).orElseThrow(GoogleTokenVerifier::invalidCredential);
            if (Boolean.TRUE.equals(jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM teacher_google_accounts WHERE teacher_id = ?)",
                    Boolean.class, teacher.getId()))) {
                throw ApiException.conflict("GOOGLE_ALREADY_LINKED",
                        "Ce compte QuizFlow est déjà associé à un autre compte Google.");
            }
            return teacher;
        }
        String name = identity.name() == null || identity.name().isBlank() ? "Enseignant" : identity.name().strip();
        int maxLength = Math.min(100, name.codePointCount(0, name.length()));
        Teacher teacher = teachers.saveAndFlush(new Teacher(identity.email(),
                passwords.encode(UUID.randomUUID().toString()), name.substring(0, name.offsetByCodePoints(0, maxLength))));
        verified.insert(teacher.getId(), clock.instant());
        pending.findByEmail(identity.email()).ifPresent(registration -> pending.delete(registration.id()));
        return teacher;
    }

    private String proofHash(String proof) {
        return codes.bucket("google-browser-proof", proof);
    }

    record Challenge(UUID nonce, String browserProof) {}
}
