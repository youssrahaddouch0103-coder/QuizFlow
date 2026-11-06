package ma.ensam.quizflow.auth;

import jakarta.validation.Valid;
import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import ma.ensam.quizflow.auth.EmailVerificationDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth/email")
public class EmailVerificationController {
    private final EmailVerificationService verification;
    public EmailVerificationController(EmailVerificationService verification) { this.verification = verification; }
    @PostMapping("/verify")
    public AuthResponse verify(@Valid @RequestBody VerifyRequest request) {
        return verification.verify(request.challengeId(), request.code());
    }
    @PostMapping("/resend")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public PendingRegistrationResponse resend(@Valid @RequestBody ResendRequest request) {
        return verification.resend(request.challengeId());
    }
}
