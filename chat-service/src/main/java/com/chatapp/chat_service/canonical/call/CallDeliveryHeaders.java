package com.chatapp.chat_service.canonical.call;

import java.util.UUID;
import org.springframework.messaging.MessageHeaders;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;

/** Internal SIMP metadata survives conversion/routing; not STOMP native/client headers. */
public final class CallDeliveryHeaders {
    private static final String ROOM = "noiCallRoom", CALL = "noiCallId", REVISION = "noiCallRevision", KIND = "noiCallKind";
    private CallDeliveryHeaders() { }
    public static MessageHeaders of(CallDelivery delivery) {
        var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        headers.setHeader(ROOM, delivery.conversationId()); headers.setHeader(CALL, delivery.callId());
        headers.setHeader(REVISION, delivery.revision()); headers.setHeader(KIND, delivery.kind());
        headers.setLeaveMutable(true);
        return headers.getMessageHeaders();
    }
    public static CallDelivery read(MessageHeaders headers) {
        if (!(headers.get(ROOM) instanceof UUID room) || !(headers.get(CALL) instanceof UUID call)
                || !(headers.get(REVISION) instanceof UUID revision) || !(headers.get(KIND) instanceof CallDelivery.Kind kind)) {
            throw new IllegalArgumentException("server call delivery scope is required");
        }
        return new CallDelivery(room, call, revision, kind);
    }
}
