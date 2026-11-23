package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;
import ma.ensam.quizflow.activity.ActivityEnums.QuestionKind;
import ma.ensam.quizflow.session.SessionDtos.ContributionView;
import ma.ensam.quizflow.session.SessionDtos.RankItem;
import ma.ensam.quizflow.session.SessionDtos.RatingStats;
import ma.ensam.quizflow.session.SessionDtos.WordCount;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class QuestionAggregatesTest {

    private final UUID session = UUID.randomUUID();

    private Answer text(String t) {
        return Answer.text(UUID.randomUUID(), session, "q1", t);
    }

    @Test
    void wordsAreGroupedWithoutCaseAndSortedByCount() {
        List<WordCount> words = QuestionAggregates.words(List.of(text("Java"), text(" java "), text("Python"), text("  ")));
        assertThat(words).containsExactly(new WordCount("Java", 2), new WordCount("Python", 1));
    }

    @Test
    void ratingGivesAverageAndDistribution() {
        RatingStats stats = QuestionAggregates.rating(List.of(
                Answer.number(UUID.randomUUID(), session, "q1", 5),
                Answer.number(UUID.randomUUID(), session, "q1", 4),
                Answer.number(UUID.randomUUID(), session, "q1", 3)));
        assertThat(stats.average()).isEqualTo(4.0);
        assertThat(stats.distribution()).containsEntry(5, 1L).containsEntry(1, 0L);
        assertThat(QuestionAggregates.rating(List.of()).average()).isNull();
    }

    @Test
    void rankingSortsByAveragePosition() {
        List<Activity.Choice> items = new ArrayList<>(List.of(
                new Activity.Choice("a", 1, "Java", false),
                new Activity.Choice("b", 2, "Python", false),
                new Activity.Choice("c", 3, "C", false)));
        Activity.Question q = new Activity.Question("q1", 1, "?", QuestionKind.CLASSEMENT, ChoiceMode.UNIQUE, items);
        List<RankItem> ranking = QuestionAggregates.ranking(q, List.of(
                Answer.ranking(UUID.randomUUID(), session, "q1", List.of("b", "a", "c")),
                Answer.ranking(UUID.randomUUID(), session, "q1", List.of("b", "c", "a"))));
        assertThat(ranking).extracting(RankItem::choiceId).containsExactly("b", "a", "c");
        assertThat(ranking.get(0).averagePosition()).isEqualTo(1.0);
        assertThat(ranking.get(1).averagePosition()).isEqualTo(2.5);
    }

    @Test
    void contributionsAreSortedByVotesAndHiddenOnesCanBeExcluded() {
        Contribution first = new Contribution(session, "q1", UUID.randomUUID(), "Question A");
        Contribution popular = new Contribution(session, "q1", UUID.randomUUID(), "Question B");
        popular.toggleVote(UUID.randomUUID());
        popular.toggleVote(UUID.randomUUID());
        Contribution hidden = new Contribution(session, "q1", UUID.randomUUID(), "Hors sujet");
        hidden.setHidden(true);

        List<ContributionView> all = QuestionAggregates.contributions(List.of(first, popular, hidden), true);
        assertThat(all).extracting(ContributionView::text).containsExactly("Question B", "Question A", "Hors sujet");
        assertThat(QuestionAggregates.contributions(List.of(first, popular, hidden), false)).hasSize(2);
    }

    @Test
    void aSecondVoteRemovesTheVote() {
        Contribution c = new Contribution(session, "q1", UUID.randomUUID(), "Idée");
        UUID voter = UUID.randomUUID();
        assertThat(c.toggleVote(voter)).isTrue();
        assertThat(c.toggleVote(voter)).isFalse();
        assertThat(c.getVotes()).isZero();
    }
}
