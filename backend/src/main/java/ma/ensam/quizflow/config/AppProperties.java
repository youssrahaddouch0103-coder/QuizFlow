package ma.ensam.quizflow.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/** Propriétés "app.*" de application.yml. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Jwt jwt,
        Cors cors,
        String publicUrl,
        SessionProps session,
        Ai ai
) {
    public record Jwt(String secret, int expirationHours) {}

    public record Cors(List<String> allowedOrigins) {}

    public record SessionProps(int inactivityMinutes, long timeoutCheckMs) {}

    public record Ai(String url, int timeoutSeconds) {}
}
