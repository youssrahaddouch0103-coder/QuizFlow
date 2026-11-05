package ma.ensam.quizflow.config;

import ma.ensam.quizflow.auth.JwtService;
import ma.ensam.quizflow.auth.TeacherPrincipal;
import ma.ensam.quizflow.session.SessionRepository;
import ma.ensam.quizflow.session.SessionState;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Sécurité des WebSockets :
 * <ul>
 *   <li>CONNECT : si l'en-tête "Authorization: Bearer ..." est présent, l'enseignant est identifié ;</li>
 *   <li>SUBSCRIBE : le canal public d'une session est ouvert à tous, le canal /teacher est réservé
 *       au propriétaire de la session ;</li>
 *   <li>SEND : refusé (les actions passent par l'API REST).</li>
 * </ul>
 */
@Component
public class StompAuthInterceptor implements ChannelInterceptor {

    private static final Pattern PUBLIC = Pattern.compile("^/topic/sessions/([A-Z0-9]{6})$");
    private static final Pattern TEACHER = Pattern.compile("^/topic/sessions/([A-Z0-9]{6})/teacher$");

    private final JwtService jwtService;
    private final SessionRepository sessions;

    public StompAuthInterceptor(JwtService jwtService, @Lazy SessionRepository sessions) {
        this.jwtService = jwtService;
        this.sessions = sessions;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }
        StompCommand command = accessor.getCommand();
        if (command == StompCommand.CONNECT) {
            String header = accessor.getFirstNativeHeader("Authorization");
            if (header != null && header.startsWith("Bearer ")) {
                jwtService.parse(header.substring(7)).ifPresent(accessor::setUser);
            }
        } else if (command == StompCommand.SUBSCRIBE) {
            checkSubscription(accessor);
        } else if (command == StompCommand.SEND) {
            throw new MessageDeliveryException("Envoi direct non autorisé : utilisez l'API REST");
        }
        return message;
    }

    private void checkSubscription(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessageDeliveryException("Destination manquante");
        }
        if (PUBLIC.matcher(destination).matches()) {
            return;
        }
        Matcher m = TEACHER.matcher(destination);
        if (m.matches()) {
            if (!(accessor.getUser() instanceof TeacherPrincipal teacher)) {
                throw new MessageDeliveryException("Canal enseignant : connexion requise");
            }
            boolean owner = sessions.findByCodeAndStateIn(m.group(1), SessionState.ACTIVE)
                    .map(s -> s.getTeacherId().equals(teacher.id()))
                    .orElse(false);
            if (!owner) {
                throw new MessageDeliveryException("Canal enseignant réservé au propriétaire de la session");
            }
            return;
        }
        throw new MessageDeliveryException("Destination inconnue : " + destination);
    }
}
