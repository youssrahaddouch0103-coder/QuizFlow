package ma.ensam.quizflow.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.common.ErrorResponse;
import ma.ensam.quizflow.config.EmailVerificationProperties;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.time.Duration;
import java.util.Set;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class EmailVerificationRateLimitFilter extends OncePerRequestFilter {
    private static final Set<String> PATHS = Set.of("/api/auth/register", "/api/auth/email/verify", "/api/auth/email/resend");
    private final AuthRateLimitService limits;
    private final EmailVerificationProperties properties;
    private final ObjectMapper mapper;
    public EmailVerificationRateLimitFilter(AuthRateLimitService limits,
            EmailVerificationProperties properties, ObjectMapper mapper) {
        this.limits = limits; this.properties = properties; this.mapper = mapper;
    }
    @Override protected boolean shouldNotFilter(HttpServletRequest request) {
        return !"POST".equals(request.getMethod()) || !PATHS.contains(request.getServletPath());
    }
    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        try {
            // Never trust a client-supplied X-Forwarded-For header.
            limits.consume("ip", request.getRemoteAddr(), properties.ipRequestsPerMinute(), Duration.ofMinutes(1));
        } catch (ApiException error) {
            response.setStatus(error.getStatus().value());
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.setHeader("Retry-After", "60");
            mapper.writeValue(response.getOutputStream(), ErrorResponse.of(error.getCode(), error.getMessage()));
            return;
        }
        chain.doFilter(request, response);
    }
}
