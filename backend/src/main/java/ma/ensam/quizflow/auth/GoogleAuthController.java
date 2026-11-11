package ma.ensam.quizflow.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/google")
public class GoogleAuthController {
    private static final String COOKIE_PATH = "/api/auth/google/session";
    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "[::1]", "::1");
    private final GoogleTokenVerifier verifier;
    private final GoogleAuthService auth;
    private final AuthRateLimitService limits;

    public GoogleAuthController(GoogleTokenVerifier verifier, GoogleAuthService auth, AuthRateLimitService limits) {
        this.verifier = verifier;
        this.auth = auth;
        this.limits = limits;
    }

    @PostMapping(path = "/challenge", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ChallengeResponse> challenge(HttpServletRequest request) {
        if (verifier.clientId().isEmpty()) return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
        limits.consume("google-challenge-ip", request.getRemoteAddr(), 30, Duration.ofMinutes(1));
        var challenge = auth.issueChallenge();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, cookie(request, challenge.nonce(), challenge.browserProof(),
                        GoogleAuthService.CHALLENGE_TTL).toString())
                .body(new ChallengeResponse(verifier.clientId(), challenge.nonce()));
    }

    @PostMapping(path = "/session", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AuthResponse> session(@Valid @RequestBody SessionRequest body, HttpServletRequest request) {
        if (verifier.clientId().isEmpty()) throw GoogleTokenVerifier.unavailable();
        limits.consume("google-session-ip", request.getRemoteAddr(), 30, Duration.ofMinutes(1));
        var identity = verifier.verify(body.credential());
        String proof = browserProof(request, identity.nonce());
        if (proof == null) throw GoogleTokenVerifier.invalidCredential();
        var response = auth.openSession(identity, proof);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header(HttpHeaders.SET_COOKIE, cookie(request, identity.nonce(), "", Duration.ZERO).toString())
                .body(response);
    }

    private static String browserProof(HttpServletRequest request, UUID nonce) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies).filter(cookie -> cookie.getName().equals(cookieName(nonce)))
                .findFirst().map(Cookie::getValue).orElse(null);
    }

    private static ResponseCookie cookie(HttpServletRequest request, UUID nonce, String value, Duration ttl) {
        return ResponseCookie.from(cookieName(nonce), value)
                .httpOnly(true).secure(request.isSecure() || !LOOPBACK_HOSTS.contains(request.getServerName()))
                .sameSite("Strict").path(COOKIE_PATH).maxAge(ttl).build();
    }

    private static String cookieName(UUID nonce) {
        return "qf_google_" + nonce;
    }

    public record ChallengeResponse(String clientId, UUID nonce) {}

    public record SessionRequest(@NotBlank @Size(max = 8192) String credential, @Size(max = 100) String password) {
        @Override public String toString() { return "SessionRequest[confidentiel]"; }
    }
}
