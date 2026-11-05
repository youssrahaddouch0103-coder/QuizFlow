package ma.ensam.quizflow.common;

import org.springframework.http.HttpStatus;

/**
 * Erreur métier renvoyée au client sous la forme { "code": ..., "message": ... }.
 * Le code est stable (le frontend s'en sert), le message est lisible par un humain.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public static ApiException notFound(String code, String message) {
        return new ApiException(HttpStatus.NOT_FOUND, code, message);
    }

    public static ApiException conflict(String code, String message) {
        return new ApiException(HttpStatus.CONFLICT, code, message);
    }

    public static ApiException badRequest(String code, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static ApiException unauthorized(String code, String message) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, message);
    }

    /** Action incompatible avec l'état de la session (409 INVALID_STATE). */
    public static ApiException invalidState(String message) {
        return conflict("INVALID_STATE", message);
    }
}
