package ma.ensam.quizflow.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 100, message = "8 caractères minimum") String password,
            @NotBlank @Size(max = 100) String displayName) {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record TeacherView(Long id, String email, String displayName) {
        static TeacherView of(Teacher t) {
            return new TeacherView(t.getId(), t.getEmail(), t.getDisplayName());
        }
    }

    public record AuthResponse(String token, TeacherView teacher) {}
}
