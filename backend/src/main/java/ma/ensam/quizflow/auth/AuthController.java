package ma.ensam.quizflow.auth;

import jakarta.validation.Valid;
import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import ma.ensam.quizflow.auth.AuthDtos.LoginRequest;
import ma.ensam.quizflow.auth.AuthDtos.RegisterRequest;
import ma.ensam.quizflow.auth.AuthDtos.TeacherView;
import ma.ensam.quizflow.auth.EmailVerificationDtos.PendingRegistrationResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public PendingRegistrationResponse register(@Valid @RequestBody RegisterRequest req) {
        return authService.register(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @GetMapping("/me")
    public TeacherView me(@AuthenticationPrincipal TeacherPrincipal teacher) {
        return authService.me(teacher.id());
    }
}
