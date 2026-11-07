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

    /** Origine d'une question générée depuis un PDF (RAG) : pages citées et extrait justificatif. */
    public record QuestionSource(String documentId, String documentName, List<Integer> pages, String excerpt,
                                 Double score) {}

    public record GeneratedQuestion(String text, ChoiceMode choiceMode, List<GeneratedChoice> choices,
                                    String explanation, QuestionSource source) {}

    public record GenerateResponse(List<GeneratedQuestion> questions, String model) {}

    /** Document PDF de la bibliothèque de l'enseignant. status : PROCESSING, READY ou FAILED ; progress : 0 à 100. */
    public record DocumentView(String id, String filename, String title, long sizeBytes, int pages, int chunks,
                               String status, int progress, String error, String createdAt) {}

    /** Génération à partir d'un document : sans sujet, les questions couvrent tout le document. */
    public record DocumentGenerateRequest(
            @Size(max = 200, message = "200 caractères maximum") String topic,
            @NotNull ActivityType type,
            @Min(1) @Max(10) int count,
            String language,
            String difficulty) {}
}
