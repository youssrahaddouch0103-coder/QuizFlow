package ma.ensam.quizflow.ai;

import ma.ensam.quizflow.ai.AiDtos.GenerateRequest;
import ma.ensam.quizflow.ai.AiDtos.GenerateResponse;
import ma.ensam.quizflow.common.ApiException;
import ma.ensam.quizflow.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Appelle le microservice IA (Python / FastAPI). La clé du LLM reste dans ce service,
 * jamais dans le navigateur ni dans le backend Java.
 */
@Component
public class AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClient.class);

    private final RestClient client;

    /** Le RestClient.Builder fourni par Spring Boot réutilise l'ObjectMapper configuré (champs inconnus ignorés). */
    public AiClient(AppProperties props, RestClient.Builder builder) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(props.ai().timeoutSeconds()));
        this.client = builder
                .baseUrl(props.ai().url())
                .requestFactory(factory)
                .build();
    }

    public GenerateResponse generateQuestions(GenerateRequest req) {
        Map<String, Object> body = new HashMap<>();
        body.put("text", req.text());
        body.put("type", req.type().name());
        body.put("count", req.count());
        body.put("language", req.language() == null ? "fr" : req.language());
        body.put("difficulty", req.difficulty() == null ? "moyen" : req.difficulty());
        try {
            GenerateResponse response = client.post()
                    .uri("/v1/questions/generate")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GenerateResponse.class);
            if (response == null || response.questions() == null) {
                throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_BAD_RESPONSE", "Réponse vide du service IA");
            }
            return response;
        } catch (ResourceAccessException e) {
            log.warn("Service IA injoignable : {}", e.getMessage());
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI_UNAVAILABLE",
                    "Le service IA est indisponible pour le moment");
        } catch (RestClientResponseException e) {
            log.warn("Erreur du service IA ({}) : {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new ApiException(HttpStatus.BAD_GATEWAY, "AI_ERROR",
                    "Le service IA n'a pas pu générer de questions, réessayez");
        }
    }
}
