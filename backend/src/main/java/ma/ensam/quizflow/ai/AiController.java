package ma.ensam.quizflow.ai;

import jakarta.validation.Valid;
import ma.ensam.quizflow.ai.AiDtos.GenerateRequest;
import ma.ensam.quizflow.ai.AiDtos.GenerateResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * W7 : l'IA propose, l'enseignant décide. Les questions générées ne sont PAS enregistrées :
 * le frontend les ajoute à l'éditeur, et l'enseignant les relit avant d'enregistrer l'activité.
 */
@RestController
@RequestMapping("/api/ai")
public class AiController {

    private final AiClient aiClient;

    public AiController(AiClient aiClient) {
        this.aiClient = aiClient;
    }

    @PostMapping("/questions")
    public GenerateResponse generate(@Valid @RequestBody GenerateRequest req) {
        return aiClient.generateQuestions(req);
    }
}
