package ma.ensam.quizflow.auth;

import java.security.Principal;

/** Enseignant authentifié, placé dans le contexte de sécurité par le filtre JWT. */
public record TeacherPrincipal(Long id, String email, String displayName) implements Principal {

    @Override
    public String getName() {
        return String.valueOf(id);
    }
}
