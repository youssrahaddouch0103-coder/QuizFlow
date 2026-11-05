package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;

import java.util.ArrayList;
import java.util.List;

/**
 * Règles W2 : une activité est PRÊTE si elle respecte toutes ces règles, sinon elle reste en BROUILLON.
 * <ul>
 *   <li>titre obligatoire ;</li>
 *   <li>au moins une question, chaque question a un énoncé ;</li>
 *   <li>2 à 6 choix par question, chaque choix a un libellé ;</li>
 *   <li>quiz : au moins une bonne réponse, et exactement une en mode UNIQUE.</li>
 * </ul>
 */
public final class ActivityValidator {

    public static final int MIN_CHOICES = 2;
    public static final int MAX_CHOICES = 6;

    private ActivityValidator() {
    }

    /** Renvoie la liste des problèmes ; vide si l'activité est prête. */
    public static List<String> validate(Activity activity) {
        List<String> errors = new ArrayList<>();
        if (isBlank(activity.getTitle())) {
            errors.add("Le titre est obligatoire");
        }
        if (activity.getQuestions() == null || activity.getQuestions().isEmpty()) {
            errors.add("Ajoutez au moins une question");
            return errors;
        }
        boolean quiz = activity.getType() == ActivityType.QUIZ;
        for (int i = 0; i < activity.getQuestions().size(); i++) {
            Activity.Question q = activity.getQuestions().get(i);
            String prefix = "Question " + (i + 1) + " : ";
            if (isBlank(q.getText())) {
                errors.add(prefix + "l'énoncé est obligatoire");
            }
            int n = q.getChoices() == null ? 0 : q.getChoices().size();
            if (n < MIN_CHOICES || n > MAX_CHOICES) {
                errors.add(prefix + "il faut entre " + MIN_CHOICES + " et " + MAX_CHOICES + " choix");
            }
            if (q.getChoices() != null && q.getChoices().stream().anyMatch(c -> isBlank(c.getLabel()))) {
                errors.add(prefix + "chaque choix doit avoir un libellé");
            }
            if (quiz && q.getChoices() != null) {
                long correct = q.getChoices().stream().filter(Activity.Choice::isCorrect).count();
                if (correct == 0) {
                    errors.add(prefix + "marquez au moins une bonne réponse");
                } else if (q.getChoiceMode() == ChoiceMode.UNIQUE && correct > 1) {
                    errors.add(prefix + "en choix unique, une seule bonne réponse est possible");
                }
            }
        }
        return errors;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
