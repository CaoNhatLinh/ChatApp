package com.chatapp.chat_service.canonical.call;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Signaling facts only: consent does not establish media attendance or duration. */
public record CallHistoryView(UUID conversationId, UUID callId, UUID callerId, UUID calleeId,
                              CallState.Type callType, Direction direction, Outcome outcome,
                              Instant createdAt, Instant acceptedAt, Instant endedAt,
                              long version, List<Participant> participants) {
    public enum Direction { INCOMING, OUTGOING }
    public enum Outcome { RINGING, ACCEPTED, CANCELLED, DECLINED, MISSED, UNANSWERED, ENDED, FAILED }
    public enum Role { CALLER, CALLEE }
    public record Participant(UUID userId, Role role, Instant initiatedAt, Instant acceptedAt) { }

    static CallHistoryView of(CallState call, UUID actor) {
        call.peerOf(actor);
        var direction = actor.equals(call.callerId()) ? Direction.OUTGOING : Direction.INCOMING;
        var outcome = Outcome.valueOf(call.status().name());
        if (call.status() == CallState.Status.MISSED) {
            if (call.acceptedAt() != null) throw new IllegalStateException("missed call authority contains consent");
            if (direction == Direction.OUTGOING) outcome = Outcome.UNANSWERED;
        }
        return new CallHistoryView(call.conversationId(), call.callId(), call.callerId(), call.calleeId(),
                call.callType(), direction, outcome, call.createdAt(), call.acceptedAt(), call.endedAt(), call.version(), List.of(
                new Participant(call.callerId(), Role.CALLER, call.createdAt(), null),
                new Participant(call.calleeId(), Role.CALLEE, null, call.acceptedAt())));
    }
}
