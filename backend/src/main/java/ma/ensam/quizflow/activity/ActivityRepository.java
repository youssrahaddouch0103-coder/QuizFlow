package ma.ensam.quizflow.activity;

import ma.ensam.quizflow.activity.ActivityEnums.ActivityStatus;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface ActivityRepository extends MongoRepository<Activity, String> {

    List<Activity> findByTeacherIdOrderByUpdatedAtDesc(Long teacherId);

    List<Activity> findByTeacherIdAndStatusOrderByUpdatedAtDesc(Long teacherId, ActivityStatus status);
}
