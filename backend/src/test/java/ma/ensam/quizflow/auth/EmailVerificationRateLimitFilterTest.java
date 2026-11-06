package ma.ensam.quizflow.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmailVerificationRateLimitFilterTest {
    @Test void rejectedRequestCannotReachControllerAndForwardedHeaderIsNotTrusted() throws Exception {
        var limits = mock(AuthRateLimitService.class);
        doThrow(AuthRateLimitService.limited()).when(limits).consume(anyString(), anyString(), anyInt(), any());
        var filter = new EmailVerificationRateLimitFilter(limits, VerificationCodeServiceTest.properties(), new ObjectMapper());
        var request = new MockHttpServletRequest("POST", "/api/auth/register");
        request.setServletPath("/api/auth/register");
        request.setRemoteAddr("192.0.2.1");
        request.addHeader("X-Forwarded-For", "198.51.100.2");
        var response = new MockHttpServletResponse();
        var chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentAsString()).contains("VERIFICATION_RATE_LIMITED");
        assertThat(chain.getRequest()).isNull();
        verify(limits).consume(eq("ip"), eq("192.0.2.1"), eq(60), any());
    }

    @Test void unrelatedRoutesAndPreflightRemainUntouched() throws Exception {
        var limits = mock(AuthRateLimitService.class);
        var filter = new EmailVerificationRateLimitFilter(limits, VerificationCodeServiceTest.properties(), new ObjectMapper());
        for (String method : new String[]{"GET", "OPTIONS"}) {
            var request = new MockHttpServletRequest(method, "/api/auth/register");
            request.setServletPath("/api/auth/register");
            var chain = new MockFilterChain();
            filter.doFilter(request, new MockHttpServletResponse(), chain);
            assertThat(chain.getRequest()).isNotNull();
        }
        verifyNoInteractions(limits);
    }
}
