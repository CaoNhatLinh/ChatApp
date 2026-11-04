package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;

/** Public tombstones retain identity, not retained investigation content. */
public final class PublicMessageView {
    private PublicMessageView() {}

    public static CanonicalMessage withPinned(CanonicalMessage m, boolean pinned) {
        if (m == null || Boolean.TRUE.equals(m.isDeleted())) return redact(m);
        if (java.util.Objects.equals(m.isPinned(), pinned)) return m;
        return new CanonicalMessage(m.conversationId(), m.messageBucket(), m.messageId(), m.senderId(),
                m.messageType(), m.content(), m.contentFormat(), m.replyToMessageId(), m.replyToSenderId(),
                m.stickerId(), m.pollId(), m.systemEventId(), m.forwardedFromConversationId(),
                m.forwardedFromMessageBucket(), m.forwardedFromMessageId(), m.isDeleted(), m.deletedBy(),
                m.deletedAt(), m.editedAt(), m.hasAttachments(), m.hasMentions(), pinned, m.createdAt(),
                m.clientMessageId(), m.gif(), m.replyToMessageBucket(), m.revision());
    }

    public static CanonicalMessage redact(CanonicalMessage message) {
        if (message == null || !Boolean.TRUE.equals(message.isDeleted())) return message;
        return new CanonicalMessage(
                message.conversationId(), message.messageBucket(), message.messageId(), message.senderId(),
                message.messageType(), "", message.contentFormat(), null, null, null, null, null,
                null, null, null, true, message.deletedBy(), message.deletedAt(), message.editedAt(),
                false, false, false, message.createdAt(), message.clientMessageId(), null, null, message.revision());
    }
}
