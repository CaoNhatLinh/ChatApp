package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.sticker.StickerCatalogService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Component;

/** Catalog availability is checked for new writes, never used to reject an already committed replay. */
@Component
public class MessageStickerPolicy {
    private final StickerCatalogService catalog;
    public MessageStickerPolicy(StickerCatalogService catalog) { this.catalog = catalog; }

    public void validateShape(String messageType, MessageSendRequest request) {
        if (!"STICKER".equals(messageType)) {
            if (request.stickerId() != null) throw new BadRequestException("stickerId requires STICKER messageType");
            return;
        }
        if (request.stickerId() == null || !"".equals(request.content())
                || !"PLAIN".equalsIgnoreCase(request.contentFormat().trim()) || request.pollId() != null
                || (request.attachments() != null && !request.attachments().isEmpty())) {
            throw new BadRequestException("sticker messages require stickerId, empty PLAIN content and no attachments or poll");
        }
    }

    public void validateAvailable(String messageType, MessageSendRequest request) {
        if ("STICKER".equals(messageType)) catalog.requireSendable(request.stickerId());
    }
}
