package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;

import java.util.ArrayList;
import java.util.List;

/**
 * Règles W2 : une activité est PRÊTE si elle respecte toutes ces règles, sinon elle reste en BROUILLON.
 * <ul>
 *   <li>titre obligatoire ;</li>
 *   <li>au moins une question, chaque question a un énoncé ;</li>
 *   <li>choix et classement : 2 à 6 choix (ou éléments), chacun avec un libellé ;</li>
 *   <li>quiz : uniquement des questions à choix, chacune avec au moins une bonne réponse (une seule en mode UNIQUE) ;</li>
 *   <li>sondage : tous les types, sans bonne réponse.</li>
 *   <li>nuage de mots, texte libre, note, questions du public et idées : l'énoncé suffit.</li>
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
            QuestionKind kind = q.getKind();
            if (quiz && kind != QuestionKind.CHOIX) {
                errors.add(prefix + "ce type de question est réservé aux sondages");
                continue;
            }
            if (!kind.usesChoices()) {
                continue;
            }
            String word = kind == QuestionKind.CLASSEMENT ? "éléments" : "choix";
            int n = q.getChoices() == null ? 0 : q.getChoices().size();
            if (n < MIN_CHOICES || n > MAX_CHOICES) {
                errors.add(prefix + "il faut entre " + MIN_CHOICES + " et " + MAX_CHOICES + " " + word);
            }
            if (q.getChoices() != null && q.getChoices().stream().anyMatch(c -> isBlank(c.getLabel()))) {
                errors.add(prefix + (kind == QuestionKind.CLASSEMENT ? "chaque élément doit avoir un libellé"
                        : "chaque choix doit avoir un libellé"));
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

    /** Une question rapporte des points si c'est une question à choix avec au moins une bonne réponse. */
    public static boolean isGraded(Activity.Question q) {
        return q.getKind() == QuestionKind.CHOIX && q.getChoices() != null
                && q.getChoices().stream().anyMatch(Activity.Choice::isCorrect);
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
