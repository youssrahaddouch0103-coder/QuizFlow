package ma.ensam.quizflow.common;

import java.util.List;

public record ErrorResponse(String code, String message, List<FieldError> details) {

    public record FieldError(String field, String message) {}

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }
}
