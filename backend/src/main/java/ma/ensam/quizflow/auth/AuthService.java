package ma.ensam.quizflow.auth;

import ma.ensam.quizflow.auth.AuthDtos.AuthResponse;
import ma.ensam.quizflow.auth.AuthDtos.LoginRequest;
import ma.ensam.quizflow.auth.AuthDtos.RegisterRequest;
import ma.ensam.quizflow.auth.AuthDtos.TeacherView;
import ma.ensam.quizflow.common.ApiException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final TeacherRepository teachers;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(TeacherRepository teachers, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.teachers = teachers;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (teachers.findByEmailIgnoreCase(email).isPresent()) {
            throw ApiException.conflict("EMAIL_TAKEN", "Un compte existe déjà avec cet email");
        }
        Teacher teacher = teachers.save(new Teacher(email, passwordEncoder.encode(req.password()),
                req.displayName().trim()));
        return new AuthResponse(jwtService.generate(teacher), TeacherView.of(teacher));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest req) {
        Teacher teacher = teachers.findByEmailIgnoreCase(req.email().trim())
                .filter(t -> passwordEncoder.matches(req.password(), t.getPasswordHash()))
                .orElseThrow(() -> ApiException.unauthorized("BAD_CREDENTIALS", "Email ou mot de passe incorrect"));
        return new AuthResponse(jwtService.generate(teacher), TeacherView.of(teacher));
    }

    @Transactional(readOnly = true)
    public TeacherView me(Long teacherId) {
        return teachers.findById(teacherId).map(TeacherView::of)
                .orElseThrow(() -> ApiException.unauthorized("UNAUTHORIZED", "Compte introuvable"));
    }
}
