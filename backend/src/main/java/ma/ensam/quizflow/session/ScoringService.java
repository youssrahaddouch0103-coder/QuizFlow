package ma.ensam.quizflow.session;

import ma.ensam.quizflow.activity.Activity;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Calculs purs (sans base de données), faciles à tester :
 * correction d'une réponse, scores et classement, statistiques par question.
 */
@Service
public class ScoringService {

    /** Score d'un participant. */
    public record Score(UUID participantId, int score, int rank) {}

    /** Statistiques d'une question. */
    public record Stats(String questionId, int position, int answerCount, Double successRate,
                        Map<String, Long> distribution) {}

    /** Choix multiple en tout ou rien : la réponse est juste si l'ensemble choisi = l'ensemble des bonnes réponses. */
    public boolean isCorrect(Activity.Question question, Set<String> choiceIds) {
        Set<String> expected = question.getChoices().stream()
                .filter(Activity.Choice::isCorrect)
                .map(Activity.Choice::getId)
                .collect(Collectors.toSet());
        return !expected.isEmpty() && expected.equals(choiceIds);
    }

    /**
     * 1 point par bonne réponse ; classement "à la RANK()" : les ex aequo ont le même rang
     * et le rang suivant saute (1, 2, 2, 4).
     */
    public List<Score> computeScores(Collection<UUID> participantIds, Collection<Answer> answers) {
        Map<UUID, Integer> points = new HashMap<>();
        participantIds.forEach(id -> points.put(id, 0));
        for (Answer a : answers) {
            if (Boolean.TRUE.equals(a.getCorrect())) {
                points.merge(a.getParticipantId(), 1, Integer::sum);
            }
        }
        List<Map.Entry<UUID, Integer>> sorted = new ArrayList<>(points.entrySet());
        sorted.sort(Map.Entry.<UUID, Integer>comparingByValue().reversed());
        List<Score> scores = new ArrayList<>();
        int rank = 0;
        Integer previous = null;
        for (int i = 0; i < sorted.size(); i++) {
            int value = sorted.get(i).getValue();
            if (previous == null || value != previous) {
                rank = i + 1;
                previous = value;
            }
            scores.add(new Score(sorted.get(i).getKey(), value, rank));
        }
        return scores;
    }

    /** Statistiques de chaque question de l'activité, à partir de toutes les réponses de la session. */
    public List<Stats> computeStats(List<Activity.Question> questions, Collection<Answer> answers, boolean quiz) {
        Map<String, List<Answer>> byQuestion = answers.stream()
                .collect(Collectors.groupingBy(Answer::getQuestionId));
        List<Stats> stats = new ArrayList<>();
        for (Activity.Question q : questions) {
            List<Answer> list = byQuestion.getOrDefault(q.getId(), List.of());
            Map<String, Long> distribution = new LinkedHashMap<>();
            q.getChoices().forEach(c -> distribution.put(c.getId(), 0L));
            for (Answer a : list) {
                a.getChoiceIds().forEach(cid -> distribution.merge(cid, 1L, Long::sum));
            }
            Double successRate = null;
            if (quiz) {
                long correct = list.stream().filter(a -> Boolean.TRUE.equals(a.getCorrect())).count();
                successRate = list.isEmpty() ? 0.0 : (double) correct / list.size();
            }
            stats.add(new Stats(q.getId(), q.getPosition(), list.size(), successRate, distribution));
        }
        return stats;
    }
}
