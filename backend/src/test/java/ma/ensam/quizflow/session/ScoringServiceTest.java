package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ScoringServiceTest {

    private final ScoringService scoring = new ScoringService();

    private static Activity.Question question(String id, ChoiceMode mode, String... correctIds) {
        List<Activity.Choice> choices = new ArrayList<>();
        for (String c : List.of("a", "b", "c")) {
            choices.add(new Activity.Choice(c, 0, c.toUpperCase(), List.of(correctIds).contains(c)));
        }
        return new Activity.Question(id, 1, "?", mode, choices);
    }

    @Test
    void uniqueChoiceIsCorrectOnlyWithTheRightChoice() {
        Activity.Question q = question("q1", ChoiceMode.UNIQUE, "a");
        assertThat(scoring.isCorrect(q, Set.of("a"))).isTrue();
        assertThat(scoring.isCorrect(q, Set.of("b"))).isFalse();
    }

    @Test
    void multipleChoiceIsAllOrNothing() {
        Activity.Question q = question("q1", ChoiceMode.MULTIPLE, "a", "b");
        assertThat(scoring.isCorrect(q, Set.of("a", "b"))).isTrue();
        assertThat(scoring.isCorrect(q, Set.of("a"))).isFalse();
        assertThat(scoring.isCorrect(q, Set.of("a", "b", "c"))).isFalse();
    }

    @Test
    void ranksTiesLikeSqlRank() {
        UUID p1 = UUID.randomUUID(), p2 = UUID.randomUUID(), p3 = UUID.randomUUID(), p4 = UUID.randomUUID();
        UUID s = UUID.randomUUID();
        List<Answer> answers = List.of(
                new Answer(p1, s, "q1", true, Set.of("a")),
                new Answer(p1, s, "q2", true, Set.of("a")),
                new Answer(p2, s, "q1", true, Set.of("a")),
                new Answer(p3, s, "q1", true, Set.of("a")),
                new Answer(p4, s, "q1", false, Set.of("b")));

        List<ScoringService.Score> scores = scoring.computeScores(List.of(p1, p2, p3, p4), answers);

        assertThat(scores).extracting(ScoringService.Score::score).containsExactly(2, 1, 1, 0);
        assertThat(scores).extracting(ScoringService.Score::rank).containsExactly(1, 2, 2, 4);
    }

    @Test
    void statsCountEveryChoiceAndSuccessRate() {
        Activity.Question q = question("q1", ChoiceMode.UNIQUE, "a");
        UUID s = UUID.randomUUID();
        List<Answer> answers = List.of(
                new Answer(UUID.randomUUID(), s, "q1", true, Set.of("a")),
                new Answer(UUID.randomUUID(), s, "q1", false, Set.of("b")));

        ScoringService.Stats stats = scoring.computeStats(List.of(q), answers, true).get(0);

        assertThat(stats.answerCount()).isEqualTo(2);
        assertThat(stats.successRate()).isEqualTo(0.5);
        assertThat(stats.distribution()).containsEntry("a", 1L).containsEntry("b", 1L).containsEntry("c", 0L);
    }

    @Test
    void onlyChoiceQuestionsHaveASuccessRateInAQuiz() {
        UUID s = UUID.randomUUID();
        Activity.Question choice = question("q1", ChoiceMode.UNIQUE, "a");
        Activity.Question cloud = new Activity.Question("q2", 2, "Un mot ?", QuestionKind.NUAGE, ChoiceMode.UNIQUE, new ArrayList<>());
        List<Answer> answers = List.of(
                new Answer(UUID.randomUUID(), s, "q1", true, Set.of("a")),
                Answer.text(UUID.randomUUID(), s, "q2", "Java"),
                Answer.text(UUID.randomUUID(), s, "q2", "java"));
        List<ScoringService.Stats> stats = scoring.computeStats(List.of(choice, cloud), answers, List.of(), true);
        assertThat(stats.get(0).successRate()).isEqualTo(1.0);
        assertThat(stats.get(1).successRate()).isNull();
        assertThat(stats.get(1).answerCount()).isEqualTo(2);
        assertThat(stats.get(1).details().words()).hasSize(1);
    }
}
