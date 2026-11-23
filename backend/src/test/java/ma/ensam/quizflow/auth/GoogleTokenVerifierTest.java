package ma.ensam.quizflow.auth;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;
import ma.ensam.quizflow.common.ApiException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GoogleTokenVerifierTest {
    private static final String CLIENT = "quizflow-test.apps.googleusercontent.com";
    private static final UUID NONCE = UUID.randomUUID();
    private static RSAKey signingKey;
    private static HttpServer keyServer;
    private static GoogleTokenVerifier verifier;

    @BeforeAll
    static void serveKeys() throws IOException, JOSEException {
        signingKey = new RSAKeyGenerator(2048).keyID("test").generate();
        byte[] jwks = new JWKSet(signingKey.toPublicJWK()).toString().getBytes(StandardCharsets.UTF_8);
        keyServer = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        keyServer.createContext("/keys", exchange -> {
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, jwks.length);
            try (var response = exchange.getResponseBody()) {
                response.write(jwks);
            }
        });
        keyServer.start();
        verifier = new GoogleTokenVerifier(CLIENT, "http://127.0.0.1:" + keyServer.getAddress().getPort() + "/keys");
    }

    @AfterAll
    static void stopKeyServer() {
        if (keyServer != null) keyServer.stop(0);
    }

    @Test
    void readsClaimsOnlyFromValidGoogleToken() throws JOSEException {
        var identity = verifier.verify(token("https://accounts.google.com", CLIENT, true, 120, signingKey));
        assertThat(identity.subject()).isEqualTo("google-subject");
        assertThat(identity.email()).isEqualTo("prof@gmail.com");
        assertThat(identity.nonce()).isEqualTo(NONCE);
        assertThat(identity.hostedEmail()).isTrue();
    }

    @Test
    void rejectsInvalidIssuerAudienceExpirySignatureAndUnverifiedEmail() throws JOSEException {
        String issuer = "https://accounts.google.com";
        var otherKey = new RSAKeyGenerator(2048).keyID("test").generate();
        for (String invalid : new String[] {
                token("https://example.org", CLIENT, true, 120, signingKey),
                token(issuer, "wrong-client", true, 120, signingKey),
                token(issuer, CLIENT, true, -120, signingKey),
                token(issuer, CLIENT, true, 120, otherKey),
                token(issuer, CLIENT, false, 120, signingKey)
        }) {
            assertThatThrownBy(() -> verifier.verify(invalid)).isInstanceOfSatisfying(ApiException.class,
                    error -> assertThat(error.getCode()).isEqualTo("GOOGLE_CREDENTIAL_INVALID"));
        }
    }

    private static String token(String issuer, String audience, boolean verified, long validSeconds, RSAKey key)
            throws JOSEException {
        var claims = new JWTClaimsSet.Builder().issuer(issuer).audience(audience)
                .subject("google-subject").expirationTime(Date.from(Instant.now().plusSeconds(validSeconds)))
                .claim("email", "Prof@gmail.com").claim("email_verified", verified)
                .claim("nonce", NONCE.toString()).build();
        var token = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        token.sign(new RSASSASigner(key));
        return token.serialize();
    }
}
