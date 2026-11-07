package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EmailVerificationControllerTest {
    @Test void malformedCodeNeverReachesBusinessService() throws Exception {
        var service = mock(EmailVerificationService.class);
        var mvc = MockMvcBuilders.standaloneSetup(new EmailVerificationController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(post("/api/auth/email/verify").contentType("application/json")
                .content("{\"challengeId\":\"00000000-0000-0000-0000-000000000001\",\"code\":\"abc\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(service);
    }
}
