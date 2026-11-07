package ma.ensam.quizflow.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import ma.ensam.quizflow.ai.AiDtos.DocumentGenerateRequest;
import ma.ensam.quizflow.ai.AiDtos.DocumentView;
import ma.ensam.quizflow.ai.AiDtos.GenerateRequest;
import ma.ensam.quizflow.ai.AiDtos.GenerateResponse;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Appelle le microservice IA (Python / FastAPI). La clé du LLM reste dans ce service,
 * jamais dans le navigateur ni dans le backend Java.
 *
 * Chaque appel porte le jeton interne (X-Internal-Token) et, pour la bibliothèque de PDF,
 * l'identifiant de l'enseignant connecté (X-Teacher-Id) : le service IA isole ainsi les
 * documents de chaque enseignant.
 */
@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);
    private static final String TOKEN_HEADER = "X-Internal-Token";
    private static final String TEACHER_HEADER = "X-Teacher-Id";

    private final RestClient client;
    private final ObjectMapper mapper;
    private final String internalToken;

    /** Le RestClient.Builder fourni par Spring Boot réutilise l'ObjectMapper configuré (champs inconnus ignorés). */
    public AiClient(AppProperties props, RestClient.Builder builder, ObjectMapper mapper) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(props.ai().timeoutSeconds()));
        this.client = builder
                .baseUrl(props.ai().url())
                .requestFactory(factory)
                .build();
        this.mapper = mapper;
        String token = props.ai().internalToken();
        this.internalToken = token == null ? "" : token;
    }

    public GenerateResponse generateQuestions(GenerateRequest req) {
        Map<String, Object> body = new HashMap<>();
        body.put("text", req.text());
        body.put("type", req.type().name());
        body.put("count", req.count());
        body.put("language", req.language() == null ? "fr" : req.language());
        body.put("difficulty", req.difficulty() == null ? "moyen" : req.difficulty());
        GenerateResponse response = call(() -> client.post()
                .uri("/v1/questions/generate")
                .header(TOKEN_HEADER, internalToken)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(GenerateResponse.class));
        return checked(response);
    }

    // ---------- Bibliothèque de documents (RAG) ----------

    public List<DocumentView> listDocuments(Long teacherId) {
        List<DocumentView> docs = call(() -> client.get()
                .uri("/v1/documents")
                .header(TOKEN_HEADER, internalToken)
                .header(TEACHER_HEADER, String.valueOf(teacherId))
                .retrieve()
                .body(new ParameterizedTypeReference<List<DocumentView>>() {}));
        return docs == null ? List.of() : docs;
    }

    public DocumentView uploadDocument(Long teacherId, String filename, byte[] content) {
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("file", new ByteArrayResource(content) {
            @Override
            public String getFilename() {
                return filename;
            }
        });
        return call(() -> client.post()
                .uri("/v1/documents")
                .header(TOKEN_HEADER, internalToken)
                .header(TEACHER_HEADER, String.valueOf(teacherId))
                .contentType(MediaType.MULTIPART_FORM_DATA)
                .body(parts)
                .retrieve()
                .body(DocumentView.class));
    }

    public void deleteDocument(Long teacherId, String documentId) {
        call(() -> client.delete()
                .uri("/v1/documents/{id}", documentId)
                .header(TOKEN_HEADER, internalToken)
                .header(TEACHER_HEADER, String.valueOf(teacherId))
                .retrieve()
                .toBodilessEntity());
    }

    public GenerateResponse generateFromDocument(Long teacherId, String documentId, DocumentGenerateRequest req) {
        Map<String, Object> body = new HashMap<>();
        if (req.topic() != null && !req.topic().isBlank()) {
            body.put("topic", req.topic().trim());
        }
        body.put("type", req.type().name());
        body.put("count", req.count());
        body.put("language", req.language() == null ? "fr" : req.language());
        body.put("difficulty", req.difficulty() == null ? "moyen" : req.difficulty());
        GenerateResponse response = call(() -> client.post()
                .uri("/v1/documents/{id}/questions", documentId)
                .header(TOKEN_HEADER, internalToken)
                .header(TEACHER_HEADER, String.valueOf(teacherId))
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(GenerateResponse.class));
        return checked(response);
    }

    // ---------- Gestion des erreurs ----------

    private GenerateResponse checked(GenerateResponse response) {
        if (response == null || response.questions() == null) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_BAD_RESPONSE", "Réponse vide du service IA");
        }
        return response;
    }

    private <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (ResourceAccessException e) {
            log.warn("Service IA injoignable : {}", e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                    "Le service IA est indisponible pour le moment");
        } catch (RestClientResponseException e) {
            log.warn("Erreur du service IA ({}) : {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw translate(e);
        }
    }

    /**
     * Les erreurs « métier » du service IA (document introuvable, PDF scanné, fichier trop lourd...)
     * arrivent sous la forme { "code", "message" } : on les relaie telles quelles au frontend.
     * Les autres deviennent une erreur générique.
     */
    private ApiException translate(RestClientResponseException e) {
        int status = e.getStatusCode().value();
        try {
            JsonNode json = mapper.readTree(e.getResponseBodyAsString());
            if (json != null && json.hasNonNull("code") && json.hasNonNull("message") && status >= 400 && status < 500) {
                HttpStatus httpStatus = HttpStatus.resolve(status);
                return new ApiException(httpStatus == null ? HttpStatus.BAD_REQUEST : httpStatus,
                        json.get("code").asText(), json.get("message").asText());
            }
        } catch (Exception ignored) {
            // Corps illisible : on tombe sur l'erreur générique ci-dessous.
        }
        if (status == 503) {
            return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                    "Le service IA est indisponible pour le moment");
        }
        return new ApiException(HttpStatus.BAD_GATEWAY, "AI_ERROR",
                "Le service IA n'a pas pu générer de questions, réessayez");
    }
}
