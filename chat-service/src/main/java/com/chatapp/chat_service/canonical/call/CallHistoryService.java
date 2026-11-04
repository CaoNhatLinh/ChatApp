package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.common.exception.*;
import java.time.Clock;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Current actor access and exact authority hydrate immutable discovery hints. */
@Service
public class CallHistoryService {
    public record Page(List<CallHistoryView> content, String nextCursor, boolean hasNext) { }
    private final CallHistoryRepository index;
    private final CallRepository calls;
    private final ConversationAuthorizationService authorization;
    private final CanonicalCqlStore store;
    private final CallLifecycleService lifecycle;
    private final Clock clock;

    @Autowired
    public CallHistoryService(CallHistoryRepository index, CallRepository calls, ConversationAuthorizationService authorization,
                              CanonicalCqlStore store, CallLifecycleService lifecycle) {
        this(index, calls, authorization, store, lifecycle, Clock.systemUTC());
    }
    CallHistoryService(CallHistoryRepository index, CallRepository calls, ConversationAuthorizationService authorization,
                       CanonicalCqlStore store, CallLifecycleService lifecycle, Clock clock) {
        this.index = index; this.calls = calls; this.authorization = authorization;
        this.store = store; this.lifecycle = lifecycle; this.clock = clock;
    }
    public Page own(UUID actor, String month, String token, int limit) {
        return list(actor, null, month, token, limit);
    }
    public Page conversation(UUID actor, UUID room, String month, String token, int limit) {
        requireId(room);
        return list(actor, room, month, token, limit);
    }
    public CallHistoryView detail(UUID actor, UUID room, UUID callId) {
        requireActor(actor); requireId(room); requireId(callId);
        return CallHistoryView.of(read(actor, room, callId, null, null), actor);
    }
    private Page list(UUID actor, UUID room, String selectedMonth, String token, int limit) {
        requireActor(actor);
        if (limit < 1 || limit > 50) throw new BadRequestException("call history limit must be between 1 and 50");
        var month = month(selectedMonth);
        var after = CallHistoryCursor.decode(actor, room, month, token);
        if (room != null) requireRoom(actor, room);
        var keys = room == null ? index.own(actor, month, after, limit) : index.conversation(room, month, after, limit);
        var content = new ArrayList<CallHistoryView>();
        for (var key : keys) {
            try {
                var state = read(actor, key.conversationId(), key.callId(), key, month);
                if (state != null) content.add(CallHistoryView.of(state, actor));
            } catch (ForbiddenException | NotFoundException inaccessibleHint) {
                // Failed/stale hints are normal; storage/invariant/contention failures remain errors.
            }
        }
        boolean more = keys.size() == limit;
        return new Page(List.copyOf(content), more ? CallHistoryCursor.encode(actor, room, month, keys.get(keys.size() - 1)) : null, more);
    }
    private CallState read(UUID actor, UUID room, UUID id, CallHistoryRepository.Key key, YearMonth month) {
        for (int attempt = 0; attempt < 4; attempt++) {
            requireRoom(actor, room);
            var state = calls.find(room, id);
            if (state == null) throw new NotFoundException("call history unavailable");
            if (!room.equals(state.conversationId()) || !id.equals(state.callId())) throw new IllegalStateException("call authority identity mismatch");
            if (key != null && (!key.startedOrder().equals(state.startedOrder())
                    || !month.equals(YearMonth.from(state.createdAt().atZone(ZoneOffset.UTC))))) return null;
            state.peerOf(actor);
            if (state.terminal() || clock.instant().isBefore(state.deadline())) return state;
            var slot = calls.slot(room);
            if (slot == null) throw new IllegalStateException("call authority slot is missing");
            // A concurrent expiry/new claim can replace the slot after our snapshot read.
            if (!id.equals(slot.activeCallId())) continue;
            lifecycle.expire(new CallRepository.Expiry(state.deadline(), room, id, state.revision(), slot.revision()));
        }
        throw new ConflictException("call history changed; reload before retrying");
    }
    private void requireRoom(UUID actor, UUID room) {
        authorization.requireMember(room, actor);
        var conversation = store.findConversation(room);
        if (conversation == null) throw new NotFoundException("conversation unavailable");
        if (!"DM".equals(conversation.conversationType())) throw new ForbiddenException("direct-call history unavailable");
        // Archive/block or peer departure restrict contact, not the member's historical facts.
    }
    private YearMonth month(String text) {
        String invalid = "call history month must be UTC YYYY-MM from 1970 through the current month";
        if (text == null || !text.matches("[0-9]{4}-(0[1-9]|1[0-2])")) throw new BadRequestException(invalid);
        var month = YearMonth.parse(text);
        var current = YearMonth.from(clock.instant().atZone(ZoneOffset.UTC));
        if (month.isBefore(YearMonth.of(1970, 1)) || month.isAfter(current)) throw new BadRequestException(invalid);
        return month;
    }
    private static void requireActor(UUID actor) {
        if (actor == null || actor.equals(CallState.SLOT_ID)) throw new ForbiddenException("authentication required");
    }
    private static void requireId(UUID id) {
        if (id == null || id.equals(CallState.SLOT_ID)) throw new BadRequestException("nonreserved call and conversation IDs are required");
    }
}
