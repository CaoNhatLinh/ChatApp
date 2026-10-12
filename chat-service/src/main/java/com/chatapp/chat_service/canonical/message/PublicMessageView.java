package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;

/** Public tombstones retain identity, not retained investigation content. */
public final class PublicMessageView {
    private PublicMessageView() {}

    public static CanonicalMessage redact(CanonicalMessage message) {
        if (message == null || !Boolean.TRUE.equals(message.isDeleted())) return message;
        return new CanonicalMessage(
                message.conversationId(), message.messageBucket(), message.messageId(), message.senderId(),
                message.messageType(), "", message.contentFormat(), null, null, null, null, null,
                null, null, null, true, message.deletedBy(), message.deletedAt(), message.editedAt(),
                false, false, false, message.createdAt(), message.clientMessageId());
    }
}
