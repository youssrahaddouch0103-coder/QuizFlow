package ma.ensam.quizflow.activity;

import jakarta.validation.Valid;
import ma.ensam.quizflow.activity.ActivityDtos.ActivityRequest;
import ma.ensam.quizflow.activity.ActivityDtos.ActivityView;
import ma.ensam.quizflow.activity.ActivityEnums.ActivityStatus;
import ma.ensam.quizflow.auth.TeacherPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** CRUD des activités de l'enseignant connecté. Aucune règle métier ici : tout est dans ActivityService. */
@RestController
@RequestMapping("/api/activities")
public class ActivityController {

    private final ActivityService service;

    public ActivityController(ActivityService service) {
        this.service = service;
    }

    @GetMapping
    public List<ActivityView> list(@AuthenticationPrincipal TeacherPrincipal teacher,
                                   @RequestParam(required = false) ActivityStatus status) {
        return service.list(teacher.id(), status);
    }

    @GetMapping("/{id}")
    public ActivityView get(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        return service.get(teacher.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityView create(@AuthenticationPrincipal TeacherPrincipal teacher,
                               @Valid @RequestBody ActivityRequest req) {
        return service.create(teacher.id(), req);
    }

    @PutMapping("/{id}")
    public ActivityView update(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id,
                               @Valid @RequestBody ActivityRequest req) {
        return service.update(teacher.id(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        service.delete(teacher.id(), id);
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    public ActivityView duplicate(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        return service.duplicate(teacher.id(), id);
    }

    @PostMapping("/{id}/archive")
    public ActivityView archive(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        return service.archive(teacher.id(), id);
    }

    @PostMapping("/{id}/restore")
    public ActivityView restore(@AuthenticationPrincipal TeacherPrincipal teacher, @PathVariable String id) {
        return service.restore(teacher.id(), id);
    }
}
