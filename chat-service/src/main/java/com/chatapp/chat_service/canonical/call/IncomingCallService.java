package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Callee-scoped discovery keys are hints; current call authority decides visibility. */
@Service
public class IncomingCallService {
    public record Page(List<CallSignalingService.View> content, String nextCursor, boolean hasNext) { }
    private record Cursor(Instant since, IncomingCallRepository.Key after) { }
    private final IncomingCallRepository index;
    private final CallLifecycleService calls;
    private final Clock clock;

    @Autowired
    public IncomingCallService(IncomingCallRepository index, CallLifecycleService calls) {
        this(index, calls, Clock.systemUTC());
    }
    IncomingCallService(IncomingCallRepository index, CallLifecycleService calls, Clock clock) {
        this.index = index; this.calls = calls; this.clock = clock;
    }

    public Page list(UUID actor, String token, int limit) {
        if (actor == null) throw new ForbiddenException("auth required");
        if (limit < 1 || limit > 50) throw new BadRequestException("incoming call limit must be between 1 and 50");
        var cursor = decode(actor, token, now());
        var keys = index.page(actor, cursor.since(), cursor.after(), limit);
        var content = new ArrayList<CallSignalingService.View>();
        for (var key : keys) {
            if (!now().isBefore(key.deadline())) continue;
            try {
                var call = calls.active(actor, key.conversationId());
                if (call != null && actor.equals(call.calleeId()) && key.callId().equals(call.callId())
                        && key.deadline().equals(call.deadline()) && call.status() == CallState.Status.RINGING
                        && now().isBefore(call.deadline())) content.add(CallSignalingService.View.of(call));
            } catch (ForbiddenException | NotFoundException | BadRequestException unavailableToActor) {
                // Stale/inaccessible hints are normal; contention/store failures must still fail the page.
            }
        }
        boolean hasNext = keys.size() == limit;
        String next = hasNext ? encode(actor, cursor.since(), keys.get(keys.size() - 1)) : null;
        return new Page(List.copyOf(content), next, hasNext);
    }

    private Cursor decode(UUID actor, String token, Instant now) {
        if (token == null) return new Cursor(now, null);
        try {
            if (token.length() > 1024) throw new IllegalArgumentException();
            if (token.isEmpty()) return new Cursor(now, null);
            String[] fields = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8).split("\\|", -1);
            if (fields.length != 6 || !"incoming-v1".equals(fields[0]) || !actor.toString().equals(fields[1])) throw new IllegalArgumentException();
            Instant since = millisecondInstant(fields[2]), deadline = millisecondInstant(fields[3]);
            if (since.isAfter(now) || since.isBefore(now.minusSeconds(60)) || !deadline.isAfter(since)) throw new IllegalArgumentException();
            return new Cursor(since, new IncomingCallRepository.Key(deadline, id(fields[4]), id(fields[5])));
        } catch (RuntimeException invalid) {
            throw new BadRequestException("invalid or expired incoming call cursor");
        }
    }
    private static Instant millisecondInstant(String value) {
        var time = Instant.parse(value);
        if (!time.equals(Instant.ofEpochMilli(time.toEpochMilli()))) throw new IllegalArgumentException();
        return time;
    }
    private static UUID id(String value) {
        var id = UUID.fromString(value);
        if (CallState.SLOT_ID.equals(id) || !id.toString().equals(value)) throw new IllegalArgumentException();
        return id;
    }
    private static String encode(UUID actor, Instant since, IncomingCallRepository.Key key) {
        String value = "incoming-v1|" + actor + "|" + since + "|" + key.deadline() + "|" + key.conversationId() + "|" + key.callId();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MILLIS); }
}
