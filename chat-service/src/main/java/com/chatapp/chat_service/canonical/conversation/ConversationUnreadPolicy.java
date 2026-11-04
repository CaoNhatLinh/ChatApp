package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.message.MessageOrder;
import java.util.UUID;

/** Projection counts are repaired from the canonical membership read pointer. */
public final class ConversationUnreadPolicy {
    private ConversationUnreadPolicy() { }
    public static boolean covered(UUID messageId, UUID readMessageId) {
        return messageId != null && readMessageId != null && MessageOrder.compare(messageId, readMessageId) <= 0;
    }
    public static int onMessage(int previousCount, UUID previousMessageId, UUID messageId, UUID readMessageId, boolean own) {
        int unread = previousMessageId == null || covered(previousMessageId, readMessageId) ? 0 : Math.max(0, previousCount);
        return own || covered(messageId, readMessageId) || unread == Integer.MAX_VALUE ? unread : unread + 1;
    }
}
