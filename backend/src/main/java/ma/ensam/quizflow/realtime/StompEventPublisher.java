package ma.ensam.quizflow.realtime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Envoie les événements via le broker STOMP.
 * Si une transaction est en cours, l'envoi attend son COMMIT : un client qui relit l'état
 * juste après l'événement voit donc toujours les données à jour.
 */
@Component
public class StompEventPublisher implements EventPublisher {

    private final SimpMessagingTemplate template;

    public StompEventPublisher(SimpMessagingTemplate template) {
        this.template = template;
    }

    @Override
    public void publish(String code, LiveEvent event) {
        send(EventPublisher.publicTopic(code), event);
    }

    @Override
    public void publishToTeacher(String code, LiveEvent event) {
        send(EventPublisher.teacherTopic(code), event);
    }

    private void send(String destination, LiveEvent event) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    template.convertAndSend(destination, event);
                }
            });
        } else {
            template.convertAndSend(destination, event);
        }
    }
}
