package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.UUID;

/** Scoped full-tuple keyset token, never authorization or a datastore paging state. */
final class CallHistoryCursor {
    private CallHistoryCursor() { }
    static CallHistoryRepository.Key decode(UUID actor, UUID room, YearMonth month, String token) {
        if (token == null || token.isEmpty()) return null;
        try {
            if (token.length() > 1024) throw new IllegalArgumentException();
            String[] fields = new String(Base64.getUrlDecoder().decode(token), StandardCharsets.UTF_8).split("\\|", -1);
            if (fields.length != 7 || !"history-v1".equals(fields[0]) || !actor.toString().equals(fields[1])
                    || !scope(room).equals(fields[2]) || !month.toString().equals(fields[3])) throw new IllegalArgumentException();
            UUID order = id(fields[4]), keyRoom = id(fields[5]), call = id(fields[6]);
            if (order.version() != 1 || room != null && !room.equals(keyRoom)) throw new IllegalArgumentException();
            long millis = Uuids.unixTimestamp(order);
            if (!order.equals(Uuids.startOf(millis))
                    || !month.equals(YearMonth.from(Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC)))) throw new IllegalArgumentException();
            return new CallHistoryRepository.Key(order, keyRoom, call);
        } catch (RuntimeException invalid) { throw new BadRequestException("invalid call history cursor"); }
    }
    static String encode(UUID actor, UUID room, YearMonth month, CallHistoryRepository.Key key) {
        String raw = "history-v1|" + actor + "|" + scope(room) + "|" + month + "|" + key.startedOrder()
                + "|" + key.conversationId() + "|" + key.callId();
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
    private static String scope(UUID room) { return room == null ? "own" : room.toString(); }
    private static UUID id(String text) {
        var id = UUID.fromString(text);
        if (id.equals(CallState.SLOT_ID) || !id.toString().equals(text)) throw new IllegalArgumentException();
        return id;
    }
}
