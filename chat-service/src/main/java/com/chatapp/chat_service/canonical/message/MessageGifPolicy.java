package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.common.exception.BadRequestException;

/** Validates provider identity only; the backend never proxies GIPHY lookups/media. */
final class MessageGifPolicy {
    private MessageGifPolicy() { }

    static void validate(String messageType, MessageSendRequest request) {
        var gif = request.gif();
        if (!"GIF".equals(messageType)) {
            if (gif != null) throw new BadRequestException("gif requires GIF messageType");
            return;
        }
        if (gif == null || !"GIPHY".equals(gif.provider()) || gif.providerGifId() == null
                || !gif.providerGifId().matches("[A-Za-z0-9_-]{1,128}") || !"".equals(request.content())
                || !"PLAIN".equalsIgnoreCase(request.contentFormat()) || request.stickerId() != null || request.pollId() != null
                || request.attachments() != null && !request.attachments().isEmpty()) {
            throw new BadRequestException("GIF messages require GIPHY provider ID, empty PLAIN content and no sticker, poll or attachments");
        }
    }
}
