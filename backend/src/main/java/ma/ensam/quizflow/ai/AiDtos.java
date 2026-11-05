package ma.ensam.quizflow.ai;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityType;
import ma.ensam.quizflow.activity.ActivityEnums.ChoiceMode;

import java.util.List;

public final class AiDtos {

    private AiDtos() {
    }

    /** Demande de génération de questions à partir d'un extrait de cours (W7). */
    public record GenerateRequest(
            @NotBlank @Size(min = 50, max = 20000, message = "Entre 50 et 20 000 caractères") String text,
            @NotNull ActivityType type,
            @Min(1) @Max(10) int count,
            String language,
            String difficulty) {}

    public record GeneratedChoice(String label, boolean correct) {}

    public record GeneratedQuestion(String text, ChoiceMode choiceMode, List<GeneratedChoice> choices,
                                    String explanation) {}

    public record GenerateResponse(List<GeneratedQuestion> questions, String model) {}
}
