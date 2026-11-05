package ma.ensam.quizflow.session;

import java.util.EnumSet;
import java.util.Set;

/** États d'une session (P1 W3, P2 §5). */
public enum SessionState {
    EN_ATTENTE,
    QUESTION_OUVERTE,
    QUESTION_FERMEE,
    TERMINEE,
    ANNULEE;

    public static final Set<SessionState> ACTIVE = EnumSet.of(EN_ATTENTE, QUESTION_OUVERTE, QUESTION_FERMEE);

    public boolean isActive() {
        return ACTIVE.contains(this);
    }
}
