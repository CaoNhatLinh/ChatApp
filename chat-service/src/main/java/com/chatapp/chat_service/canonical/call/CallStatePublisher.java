package com.chatapp.chat_service.canonical.call;

import java.time.Instant;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/** At-least-once latest-state broker handoff, not a subscriber delivery receipt. */
@Service
public class CallStatePublisher {
    public record Event(String action, java.util.UUID conversationId, java.util.UUID callId,
                        Instant occurredAt, CallSignalingService.View state) { }
    private final CallRepository calls;
    private final SimpMessagingTemplate messaging;
    public CallStatePublisher(CallRepository calls, SimpMessagingTemplate messaging) {
        this.calls = calls; this.messaging = messaging;
    }
    public boolean publish(CallState candidate) {
        var current = calls.publication(candidate.conversationId(), candidate.callId());
        if (current == null) return false;
        if (!current.state().revision().equals(candidate.revision())) return true;
        if (current.publishedVersion() >= candidate.version()) return true;
        var event = new Event("STATE", candidate.conversationId(), candidate.callId(), Instant.now(), CallSignalingService.View.of(candidate));
        var delivery = CallDelivery.of(candidate, CallDelivery.Kind.STATE);
        messaging.convertAndSend("/topic/conversation/" + candidate.conversationId() + "/calls", event, CallDeliveryHeaders.of(delivery));
        messaging.convertAndSendToUser(candidate.callerId().toString(), "/queue/calls", event, CallDeliveryHeaders.of(delivery));
        messaging.convertAndSendToUser(candidate.calleeId().toString(), "/queue/calls", event, CallDeliveryHeaders.of(delivery));
        return calls.markPublished(candidate, current.publishedVersion());
    }
}
