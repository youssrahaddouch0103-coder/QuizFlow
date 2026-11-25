package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import ma.ensam.quizflow.session.SessionDtos.ContributionView;
import ma.ensam.quizflow.session.SessionDtos.RankItem;
import ma.ensam.quizflow.session.SessionDtos.RatingStats;
import ma.ensam.quizflow.session.SessionDtos.WordCount;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Calculs purs (sans base de données) des résultats propres à chaque type de question.
 * Utilisés pour les statistiques en direct et pour les résultats figés à la fin de la séance.
 */
public final class QuestionAggregates {

    public static final int RATING_MAX = 5;
    /** Nombre maximal de textes libres renvoyés (les plus récents). */
    public static final int MAX_TEXTS = 100;

    private QuestionAggregates() {
    }

    /** Nettoie un mot ou une phrase : espaces en trop retirés. */
    public static String clean(String text) {
        return text == null ? "" : text.trim().replaceAll("\\s+", " ");
    }

    /** Nuage de mots : les réponses identiques (sans tenir compte de la casse) sont regroupées, les plus fréquentes d'abord. */
    public static List<WordCount> words(Collection<Answer> answers) {
        Map<String, String> display = new LinkedHashMap<>();
        Map<String, Long> counts = new HashMap<>();
        for (Answer a : answers) {
            String text = clean(a.getTextValue());
            if (text.isEmpty()) {
                continue;
            }
            String key = text.toLowerCase(Locale.ROOT);
            display.putIfAbsent(key, text);
            counts.merge(key, 1L, Long::sum);
        }
        List<WordCount> words = new ArrayList<>();
        display.forEach((key, text) -> words.add(new WordCount(text, counts.get(key))));
        words.sort(Comparator.comparingLong(WordCount::count).reversed());
        return words;
    }

    /** Texte libre : les réponses, de la plus récente à la plus ancienne. */
    public static List<String> texts(Collection<Answer> answers) {
        return answers.stream()
                .filter(a -> !clean(a.getTextValue()).isEmpty())
                .sorted(Comparator.comparing(Answer::getAnsweredAt).reversed())
                .limit(MAX_TEXTS)
                .map(a -> clean(a.getTextValue()))
                .toList();
    }

    /** Note : moyenne et répartition de 1 à 5. */
    public static RatingStats rating(Collection<Answer> answers) {
        Map<Integer, Long> distribution = new LinkedHashMap<>();
        for (int v = 1; v <= RATING_MAX; v++) {
            distribution.put(v, 0L);
        }
        long total = 0;
        long sum = 0;
        for (Answer a : answers) {
            Integer v = a.getNumberValue();
            if (v == null || v < 1 || v > RATING_MAX) {
                continue;
            }
            distribution.merge(v, 1L, Long::sum);
            total++;
            sum += v;
        }
        return new RatingStats(total == 0 ? null : (double) sum / total, distribution);
    }

    /** Classement : position moyenne de chaque élément, du mieux classé au moins bien classé. */
    public static List<RankItem> ranking(Activity.Question question, Collection<Answer> answers) {
        Map<String, Long> sums = new HashMap<>();
        Map<String, Long> counts = new HashMap<>();
        for (Answer a : answers) {
            List<String> order = a.getRanking();
            for (int i = 0; i < order.size(); i++) {
                sums.merge(order.get(i), (long) (i + 1), Long::sum);
                counts.merge(order.get(i), 1L, Long::sum);
            }
        }
        List<RankItem> items = new ArrayList<>();
        for (Activity.Choice c : question.getChoices()) {
            Long n = counts.get(c.getId());
            items.add(new RankItem(c.getId(), c.getLabel(), n == null ? null : (double) sums.get(c.getId()) / n));
        }
        items.sort(Comparator.comparing(RankItem::averagePosition, Comparator.nullsLast(Comparator.naturalOrder())));
        return items;
    }

    /**
     * Questions du public et idées : les plus votées d'abord, puis les plus anciennes.
     * includeHidden = false pour ce qui est envoyé aux étudiants.
     */
    public static List<ContributionView> contributions(Collection<Contribution> list, boolean includeHidden) {
        return list.stream()
                .filter(c -> includeHidden || !c.isHidden())
                .sorted(Comparator.comparingInt(Contribution::getVotes).reversed()
                        .thenComparing(Contribution::getCreatedAt))
                .map(c -> new ContributionView(c.getId().toString(), c.getText(), c.getVotes(), c.isDone(), c.isHidden()))
                .toList();
    }
}
