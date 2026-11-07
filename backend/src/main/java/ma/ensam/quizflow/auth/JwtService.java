package ma.ensam.quizflow.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import ma.ensam.quizflow.config.AppProperties;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration validity;
    private final TeacherRepository teachers;

    public JwtService(AppProperties props, TeacherRepository teachers) {
        this.teachers = teachers;
        byte[] bytes = props.jwt().secret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret doit contenir au moins 32 caractères");
        }
        this.key = Keys.hmacShaKeyFor(bytes);
        this.validity = Duration.ofHours(props.jwt().expirationHours());
    }

    public String generate(Teacher teacher) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(String.valueOf(teacher.getId()))
                .claim("email", teacher.getEmail())
                .claim("name", teacher.getDisplayName())
                .claim("authVersion", teacher.getAuthVersion())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(validity)))
                .signWith(key)
                .compact();
    }

    /** Renvoie l'enseignant si le jeton est valide, sinon vide. */
    public Optional<TeacherPrincipal> parse(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            long teacherId = Long.parseLong(claims.getSubject());
            long version = Optional.ofNullable(claims.get("authVersion", Long.class)).orElse(0L);
            if (teachers.findById(teacherId)
                    .filter(teacher -> teacher.getAuthVersion() == version).isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(new TeacherPrincipal(
                    teacherId,
                    claims.get("email", String.class),
                    claims.get("name", String.class)));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
