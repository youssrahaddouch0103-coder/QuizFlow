package ma.ensam.quizflow.session;

import jakarta.validation.Valid;
import ma.ensam.quizflow.auth.TeacherPrincipal;
import ma.ensam.quizflow.session.SessionDtos.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Pilotage des sessions par l'enseignant. */
@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService service;

    public SessionController(SessionService service) {
        this.service = service;
    }

    /** scope = active | finished (facultatif). */
    @GetMapping
    public List<SessionSummary> list(@AuthenticationPrincipal TeacherPrincipal teacher,
                                     @RequestParam(required = false) String scope) {
        return service.list(teacher.id(), scope);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeacherSessionView launch(@AuthenticationPrincipal TeacherPrincipal teacher,
                                     @Valid @RequestBody LaunchRequest req) {
        return service.launch(teacher.id(), req.activityId());
    }

    @GetMapping("/{id}")
    public TeacherSessionView get(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id) {
        return service.get(teacher.id(), id);
    }

    @PostMapping("/{id}/start")
    public TeacherSessionView start(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id,
                                    @Valid @RequestBody(required = false) TimerRequest timer) {
        return service.start(teacher.id(), id, timer == null ? null : timer.durationSeconds());
    }

    @PostMapping("/{id}/questions/close")
    public TeacherSessionView close(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id) {
        return service.closeQuestion(teacher.id(), id);
    }

    @PostMapping("/{id}/questions/next")
    public TeacherSessionView next(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id,
                                   @Valid @RequestBody(required = false) TimerRequest timer) {
        return service.next(teacher.id(), id, timer == null ? null : timer.durationSeconds());
    }

    @PostMapping("/{id}/end")
    public ResultsView end(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id) {
        return service.end(teacher.id(), id);
    }

    @PostMapping("/{id}/cancel")
    public TeacherSessionView cancel(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id) {
        return service.cancel(teacher.id(), id);
    }

    @GetMapping("/{id}/results")
    public ResultsView results(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable UUID id) {
        return service.results(teacher.id(), id);
    }
}
