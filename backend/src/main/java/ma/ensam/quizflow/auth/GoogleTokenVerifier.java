package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.ApiException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Component
public class GoogleTokenVerifier {
    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");
    private final String clientId;
    private final JwtDecoder decoder;

    @Autowired
    public GoogleTokenVerifier(@Value("${GOOGLE_CLIENT_ID:}") String clientId) {
        this(clientId, "https://www.googleapis.com/oauth2/v3/certs");
    }

    GoogleTokenVerifier(String clientId, String jwkSetUri) {
        this.clientId = clientId.trim();
        this.decoder = this.clientId.isEmpty() ? null : createDecoder(this.clientId, jwkSetUri);
    }

    public String clientId() {
        return clientId;
    }

    Identity verify(String credential) {
        if (decoder == null) throw unavailable();
        try {
            var jwt = decoder.decode(credential);
            String email = jwt.getClaimAsString("email");
            String subject = jwt.getSubject();
            String nonce = jwt.getClaimAsString("nonce");
            if (!Boolean.TRUE.equals(jwt.getClaims().get("email_verified"))
                    || email == null || email.length() > 255 || !email.matches("[^\\s@]+@[^\\s@]+")
                    || subject == null || subject.isBlank() || subject.length() > 255
                    || nonce == null || nonce.length() != 36) {
                throw invalidCredential();
            }
            email = email.toLowerCase(Locale.ROOT);
            String domain = jwt.getClaimAsString("hd");
            boolean hostedEmail = email.endsWith("@gmail.com") || (domain != null && !domain.isBlank());
            return new Identity(subject, email, jwt.getClaimAsString("name"), UUID.fromString(nonce), hostedEmail);
        } catch (BadJwtException | IllegalArgumentException ex) {
            throw invalidCredential();
        } catch (JwtException ex) {
            throw unavailable();
        }
    }

    private static JwtDecoder createDecoder(String clientId, String jwkSetUri) {
        var timeouts = new SimpleClientHttpRequestFactory();
        timeouts.setConnectTimeout(5000);
        timeouts.setReadTimeout(5000);
        var decoder = NimbusJwtDecoder.withJwkSetUri(jwkSetUri)
                .restOperations(new RestTemplate(timeouts))
                .build();
        var timestamps = JwtValidators.createDefault();
        decoder.setJwtValidator(jwt -> {
            Object issuer = jwt.getClaims().get("iss");
            String authorizedParty = jwt.getClaimAsString("azp");
            if (issuer == null || !ISSUERS.contains(issuer.toString())
                    || jwt.getAudience() == null || !jwt.getAudience().contains(clientId)
                    || (authorizedParty != null && !clientId.equals(authorizedParty))
                    || jwt.getExpiresAt() == null) {
                return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
            }
            return timestamps.validate(jwt);
        });
        return decoder;
    }

    static ApiException invalidCredential() {
        return ApiException.unauthorized("GOOGLE_CREDENTIAL_INVALID",
                "La connexion Google a expiré ou a échoué. Réessayez.");
    }

    static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "GOOGLE_UNAVAILABLE",
                "La connexion Google est indisponible. Réessayez ou utilisez votre email.");
    }

    record Identity(String subject, String email, String name, UUID nonce, boolean hostedEmail) {}
}
