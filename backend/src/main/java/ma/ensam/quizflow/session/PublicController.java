package ma.ensam.quizflow.session;

import jakarta.validation.Valid;
import ma.ensam.quizflow.config.AppProperties;
import ma.ensam.quizflow.session.SessionDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** API publique (étudiants anonymes, sans compte). */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    public static final String TOKEN_HEADER = "X-Participant-Token";

    private final PlayerService players;
    private final AppProperties props;

    public PublicController(PlayerService players, AppProperties props) {
        this.players = players;
        this.props = props;
    }

    /** Configuration utile au frontend (URL publique pour le QR code). */
    @GetMapping("/config")
    public Map<String, String> config() {
        return Map.of("publicUrl", props.publicUrl() == null ? "" : props.publicUrl());
    }

    @GetMapping("/sessions/{code}")
    public PublicSessionInfo info(@PathVariable String code) {
        return players.info(code);
    }

    @PostMapping("/sessions/{code}/join")
    @ResponseStatus(HttpStatus.CREATED)
    public JoinResponse join(@PathVariable String code, @Valid @RequestBody JoinRequest req) {
        return players.join(code, req.pseudo());
    }

    @GetMapping("/sessions/{code}/state")
    public PlayerState state(@PathVariable String code, @RequestHeader(value = TOKEN_HEADER, required = false) String token) {
        return players.state(code.toUpperCase(), token);
    }

    @PostMapping("/sessions/{code}/answers")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Boolean> answer(@PathVariable String code,
                                       @RequestHeader(value = TOKEN_HEADER, required = false) String token,
                                       @Valid @RequestBody AnswerRequest req) {
        players.submit(code.toUpperCase(), token, req);
        return Map.of("accepted", true);
    }
}
