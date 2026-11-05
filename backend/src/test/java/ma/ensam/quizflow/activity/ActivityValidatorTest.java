package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ActivityValidatorTest {

    private static Activity.Choice choice(String label, boolean correct) {
        return new Activity.Choice(label, 0, label, correct);
    }

    private static Activity quiz(ChoiceMode mode, Activity.Choice... choices) {
        Activity a = new Activity();
        a.setType(ActivityType.QUIZ);
        a.setTitle("Design patterns");
        a.setQuestions(new ArrayList<>(List.of(
                new Activity.Question("q1", 1, "Quel pattern ?", mode, new ArrayList<>(List.of(choices))))));
        return a;
    }

    @Test
    void validQuizHasNoErrors() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("Composite", true), choice("Proxy", false));
        assertThat(ActivityValidator.validate(a)).isEmpty();
    }

    @Test
    void titleIsRequired() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("A", true), choice("B", false));
        a.setTitle("  ");
        assertThat(ActivityValidator.validate(a)).anyMatch(e -> e.contains("titre"));
    }

    @Test
    void needsBetweenTwoAndSixChoices() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("A", true));
        assertThat(ActivityValidator.validate(a)).anyMatch(e -> e.contains("entre 2 et 6"));
    }

    @Test
    void quizNeedsACorrectAnswer() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("A", false), choice("B", false));
        assertThat(ActivityValidator.validate(a)).anyMatch(e -> e.contains("bonne réponse"));
    }

    @Test
    void uniqueModeAllowsOnlyOneCorrectAnswer() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("A", true), choice("B", true));
        assertThat(ActivityValidator.validate(a)).anyMatch(e -> e.contains("une seule bonne réponse"));
    }

    @Test
    void multipleModeAllowsSeveralCorrectAnswers() {
        Activity a = quiz(ChoiceMode.MULTIPLE, choice("A", true), choice("B", true), choice("C", false));
        assertThat(ActivityValidator.validate(a)).isEmpty();
    }

    @Test
    void pollDoesNotNeedCorrectAnswers() {
        Activity a = quiz(ChoiceMode.UNIQUE, choice("Oui", false), choice("Non", false));
        a.setType(ActivityType.SONDAGE);
        assertThat(ActivityValidator.validate(a)).isEmpty();
    }

    @Test
    void activityWithoutQuestionIsDraft() {
        Activity a = new Activity();
        a.setType(ActivityType.QUIZ);
        a.setTitle("Vide");
        assertThat(ActivityValidator.validate(a)).containsExactly("Ajoutez au moins une question");
    }
}
