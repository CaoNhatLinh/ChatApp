package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.*;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

/** Durable control, ephemeral bounded SDP/ICE, and correlated private results. */
@Service
public class CallSignalingService {
    public enum Action { START, JOIN, LEAVE, END, FAIL, HEARTBEAT, SYNC, SIGNAL }
    public record Command(UUID requestId, UUID conversationId, UUID callId, String callType,
                          UUID targetUserId, Map<String, Object> signal) { }
    public record View(UUID conversationId, UUID callId, UUID callerId, UUID calleeId,
                       CallState.Type callType, CallState.Status status, Instant createdAt,
                       Instant acceptedAt, Instant endedAt, Instant deadline, UUID revision, long version) {
        static View of(CallState c) { return new View(c.conversationId(), c.callId(), c.callerId(), c.calleeId(), c.callType(), c.status(), c.createdAt(), c.acceptedAt(), c.endedAt(), c.deadline(), c.revision(), c.version()); }
    }
    public record Result(UUID requestId, UUID conversationId, UUID callId, Action action,
                         boolean accepted, String errorCode, View state) { }
    private final CallLifecycleService calls;
    private final SimpMessagingTemplate messaging;
    private final CallStatePublisher publisher;
    public CallSignalingService(CallLifecycleService calls, SimpMessagingTemplate messaging, CallStatePublisher publisher) {
        this.calls = calls; this.messaging = messaging; this.publisher = publisher;
    }

    public Result execute(UUID actor, Action action, Command command) {
        try {
            validate(command);
            CallState state;
            Map<String, Object> signal = null;
            if (action == Action.START) {
                CallState.Type type;
                try { type = CallState.Type.valueOf(command.callType()); }
                catch (IllegalArgumentException | NullPointerException invalid) { throw new BadRequestException("callType is required"); }
                state = calls.start(actor, command.conversationId(), command.callId(), command.targetUserId(), type);
            } else {
                state = calls.get(actor, command.conversationId(), command.callId());
                if (!state.peerOf(actor).equals(command.targetUserId())) throw new ForbiddenException("call target does not match its participant");
                if (action == Action.SIGNAL) {
                    state = calls.authorizeSignal(actor, command.conversationId(), command.callId(), command.targetUserId());
                    signal = signal(command.signal(), actor.equals(state.callerId()));
                } else if (action != Action.SYNC) {
                    var transition = switch (action) {
                        case JOIN -> CallState.Action.ACCEPT;
                        case LEAVE -> CallState.Action.LEAVE;
                        case END -> CallState.Action.END;
                        case FAIL -> CallState.Action.FAIL;
                        case HEARTBEAT -> CallState.Action.HEARTBEAT;
                        default -> throw new BadRequestException("unsupported call action");
                    };
                    state = calls.change(actor, command.conversationId(), command.callId(), transition);
                }
            }
            View view = View.of(state);
            if (action != Action.SIGNAL) {
                if (!publisher.publish(state)) throw new IllegalStateException("call publication is pending");
                return result(command, action, true, null, view);
            }
            // Signals are ephemeral and keep authenticated participant attribution.
            var event = new LinkedHashMap<String, Object>();
            event.put("conversationId", state.conversationId()); event.put("callId", state.callId());
            event.put("actorId", actor);
            event.put("targetUserId", state.peerOf(actor)); event.put("occurredAt", Instant.now());
            event.put("action", "SIGNAL");
            event.put("state", view);
            if (signal != null) event.put("signal", signal);
            messaging.convertAndSend("/topic/conversation/" + state.conversationId() + "/calls", event,
                    CallDeliveryHeaders.of(CallDelivery.of(state, CallDelivery.Kind.SIGNAL)));
            return result(command, action, true, null, view);
        } catch (BadRequestException invalid) { return result(command, action, false, "INVALID", null); }
        catch (ForbiddenException denied) { return result(command, action, false, "FORBIDDEN", null); }
        catch (NotFoundException missing) { return result(command, action, false, "NOT_FOUND", null); }
        catch (ConflictException conflict) { return result(command, action, false, "CONFLICT", null); }
        catch (RuntimeException unavailable) {
            // No exception payload/log here: signaling may contain private SDP/ICE.
            // The mutation may already be committed. Retry/sync the same call ID.
            return result(command, action, false, "UNAVAILABLE", null);
        }
    }
    private Result result(Command c, Action action, boolean accepted, String error, View view) {
        return new Result(c == null ? null : c.requestId(), c == null ? null : c.conversationId(), c == null ? null : c.callId(), action, accepted, error, view);
    }
    private void validate(Command c) {
        if (c == null || c.requestId() == null || c.conversationId() == null || c.callId() == null || c.targetUserId() == null || c.callId().equals(CallState.SLOT_ID)) {
            throw new BadRequestException("requestId, conversationId, callId and targetUserId are required");
        }
    }
    private Map<String, Object> signal(Map<String, Object> raw, boolean caller) {
        if (raw == null) throw new BadRequestException("signal is required");
        if ("sdp".equals(raw.get("kind")) && raw.get("description") instanceof Map<?, ?> description) {
            String required = caller ? "offer" : "answer";
            if (!required.equals(description.get("type")) || !(description.get("sdp") instanceof String sdp) || sdp.isBlank() || sdp.length() > 65536) {
                throw new BadRequestException("invalid SDP for this participant");
            }
            return Map.of("kind", "sdp", "description", Map.of("type", required, "sdp", sdp));
        }
        if ("ice".equals(raw.get("kind")) && raw.get("candidate") instanceof Map<?, ?> candidate
                && candidate.get("candidate") instanceof String text && text.length() <= 8192) {
            var clean = new LinkedHashMap<String, Object>(); clean.put("candidate", text);
            for (String key : new String[]{"sdpMid", "usernameFragment"}) {
                Object value = candidate.get(key);
                if (value != null && (!(value instanceof String s) || s.length() > 256)) throw new BadRequestException("invalid ICE metadata");
                clean.put(key, value);
            }
            Object line = candidate.get("sdpMLineIndex");
            if (line != null && (!(line instanceof Integer n) || n < 0 || n > 65535)) throw new BadRequestException("invalid ICE line");
            clean.put("sdpMLineIndex", line);
            return Map.of("kind", "ice", "candidate", clean);
        }
        throw new BadRequestException("invalid signal");
    }
}
