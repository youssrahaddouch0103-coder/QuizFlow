package ma.ensam.quizflow.activity;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityStatus;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;

import java.time.Instant;
import java.util.List;

public final class ActivityDtos {

    private ActivityDtos() {
    }

    /**
     * Enregistrement d'une activité. Un brouillon peut être incomplet : seules les tailles
     * maximales sont contrôlées ici ; les règles W2 décident du statut (BROUILLON ou PRETE).
     */
    public record ActivityRequest(
            @NotNull ActivityType type,
            @Size(max = 200) String title,
            @Size(max = 1000) String description,
            @Size(max = 100) List<@Valid QuestionRequest> questions) {}

    public record QuestionRequest(
            String id,
            @Size(max = 500) String text,
            ChoiceMode choiceMode,
            @Size(max = ActivityValidator.MAX_CHOICES) List<@Valid ChoiceRequest> choices) {}

    public record ChoiceRequest(String id, @Size(max = 200) String label, boolean correct) {}

    public record ChoiceView(String id, int position, String label, boolean correct) {}

    public record QuestionView(String id, int position, String text, ChoiceMode choiceMode, List<ChoiceView> choices) {}

    public record ActivityView(
            String id,
            ActivityType type,
            String title,
            String description,
            ActivityStatus status,
            boolean locked,
            List<String> errors,
            List<QuestionView> questions,
            int questionCount,
            Instant createdAt,
            Instant updatedAt) {}

    public static ActivityView view(Activity a, boolean locked) {
        List<QuestionView> questions = a.getQuestions().stream()
                .map(q -> new QuestionView(q.getId(), q.getPosition(), q.getText(), q.getChoiceMode(),
                        q.getChoices().stream()
                                .map(c -> new ChoiceView(c.getId(), c.getPosition(), c.getLabel(), c.isCorrect()))
                                .toList()))
                .toList();
        return new ActivityView(a.getId(), a.getType(), a.getTitle(), a.getDescription(), a.getStatus(), locked,
                ActivityValidator.validate(a), questions, questions.size(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
