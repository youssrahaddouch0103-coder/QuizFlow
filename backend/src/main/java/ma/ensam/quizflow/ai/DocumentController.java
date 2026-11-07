package ma.ensam.quizflow.ai;

import jakarta.validation.Valid;
import ma.ensam.quizflow.ai.AiDtos.DocumentGenerateRequest;
import ma.ensam.quizflow.ai.AiDtos.DocumentView;
import ma.ensam.quizflow.ai.AiDtos.GenerateResponse;
import ma.ensam.quizflow.auth.TeacherPrincipal;
import ma.ensam.quizflow.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Bibliothèque de PDF de l'enseignant (RAG). Le backend vérifie l'identité (JWT) puis relaie
 * au service IA, qui découpe le PDF, calcule les embeddings et les range dans pgvector.
 * Comme pour le texte collé, les questions générées ne sont pas enregistrées : l'enseignant les relit.
 */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private static final long MAX_BYTES = 20L * 1024 * 1024;

    private final AiClient aiClient;

    public DocumentController(AiClient aiClient) {
        this.aiClient = aiClient;
    }

    @GetMapping
    public List<DocumentView> list(@AuthenticationPrincipal TeacherPrincipal teacher) {
        return aiClient.listDocuments(teacher.id());
    }

    @PostMapping(consumes = "multipart/form-data")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public DocumentView upload(@AuthenticationPrincipal TeacherPrincipal teacher,
                               @RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) {
            throw ApiException.badRequest("EMPTY_FILE", "Le fichier est vide");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "Fichier trop lourd : 20 Mo maximum.");
        }
        String name = file.getOriginalFilename() == null ? "document.pdf" : file.getOriginalFilename();
        return aiClient.uploadDocument(teacher.id(), name, file.getBytes());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        aiClient.deleteDocument(teacher.id(), id);
    }

    @PostMapping("/{id}/questions")
    public GenerateResponse generate(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id,
                                     @Valid @RequestBody DocumentGenerateRequest req) {
        return aiClient.generateFromDocument(teacher.id(), id, req);
    }
}
