package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import java.time.Instant;
import java.util.UUID;

/** Signaling authority only: ACCEPTED must never be presented as verified media. */
public record CallState(UUID conversationId, UUID callId, UUID startedOrder,
                        UUID callerId, UUID calleeId, Type callType, Status status,
                        Instant createdAt, Instant acceptedAt, Instant endedAt,
                        Instant callerSeenAt, Instant calleeSeenAt, Instant deadline, UUID revision, long version) {
    public static final UUID SLOT_ID = new UUID(0, 0);
    public enum Type { VOICE, VIDEO }
    public enum Status { RINGING, ACCEPTED, CANCELLED, DECLINED, MISSED, ENDED, FAILED }
    public enum Action { ACCEPT, LEAVE, END, FAIL, HEARTBEAT }

    public static CallState ringing(UUID room, UUID id, UUID order, UUID caller, UUID callee,
                                    Type type, Instant now, UUID revision) {
        if (room == null || id == null || caller == null || callee == null || type == null
                || SLOT_ID.equals(id) || caller.equals(callee)) {
            throw new BadRequestException("a direct call requires a room, distinct participants, type and nonreserved callId");
        }
        return new CallState(room, id, order, caller, callee, type, Status.RINGING,
                now, null, null, now, null, now.plusSeconds(45), revision, 1);
    }

    public boolean terminal() { return status != Status.RINGING && status != Status.ACCEPTED; }

    public UUID peerOf(UUID actor) {
        if (callerId.equals(actor)) return calleeId;
        if (calleeId.equals(actor)) return callerId;
        throw new ForbiddenException("call participant is required");
    }

    public boolean sameIdentity(CallState other) {
        return conversationId.equals(other.conversationId) && callId.equals(other.callId)
                && callerId.equals(other.callerId) && calleeId.equals(other.calleeId) && callType == other.callType;
    }

    public CallState expire(Instant now, UUID nextRevision) {
        if (terminal() || now.isBefore(deadline)) return this;
        // Persist the deadline, not the worker's eventual wake-up time, as the end.
        return finish(status == Status.RINGING ? Status.MISSED : Status.FAILED, deadline, nextRevision);
    }

    public CallState apply(UUID actor, Action action, Instant now, UUID nextRevision) {
        peerOf(actor);
        if (action == null) throw new BadRequestException("call action is required");
        CallState expired = expire(now, nextRevision);
        if (expired != this || terminal()) return expired;
        if (now.isBefore(createdAt) || (acceptedAt != null && now.isBefore(acceptedAt))) {
            throw new ConflictException("call clock moved backwards");
        }
        return switch (action) {
            case ACCEPT -> {
                if (!calleeId.equals(actor)) throw new ForbiddenException("only the recipient can accept a call");
                if (status == Status.ACCEPTED) yield this;
                yield new CallState(conversationId, callId, startedOrder, callerId, calleeId, callType,
                        Status.ACCEPTED, createdAt, now, null, callerSeenAt, now,
                        callerSeenAt.plusSeconds(90), nextRevision, version + 1);
            }
            case LEAVE, END -> finish(status == Status.ACCEPTED ? Status.ENDED
                    : callerId.equals(actor) ? Status.CANCELLED : Status.DECLINED, now, nextRevision);
            case FAIL -> finish(Status.FAILED, now, nextRevision);
            case HEARTBEAT -> heartbeat(actor, now, nextRevision);
        };
    }

    private CallState heartbeat(UUID actor, Instant now, UUID nextRevision) {
        if (status == Status.RINGING && !callerId.equals(actor)) {
            throw new ConflictException("recipient must accept before heartbeating");
        }
        Instant previous = callerId.equals(actor) ? callerSeenAt : calleeSeenAt;
        if (!now.isAfter(previous)) return this;
        Instant callerSeen = callerId.equals(actor) ? now : callerSeenAt;
        Instant calleeSeen = calleeId.equals(actor) ? now : calleeSeenAt;
        Instant nextDeadline = status == Status.RINGING ? deadline
                : (callerSeen.isBefore(calleeSeen) ? callerSeen : calleeSeen).plusSeconds(90);
        return new CallState(conversationId, callId, startedOrder, callerId, calleeId, callType, status,
                createdAt, acceptedAt, null, callerSeen, calleeSeen, nextDeadline, nextRevision, version + 1);
    }

    private CallState finish(Status terminal, Instant end, UUID nextRevision) {
        return new CallState(conversationId, callId, startedOrder, callerId, calleeId, callType, terminal,
                createdAt, acceptedAt, end, callerSeenAt, calleeSeenAt, deadline, nextRevision, version + 1);
    }
}
