package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.message.MessageService;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import java.util.UUID;

/** History artwork requires message access, not current catalog publication or admin privileges. */
@Service
public class StickerMessageService {
    private final MessageService messages;
    private final StickerCatalogService catalog;
    public StickerMessageService(MessageService messages, StickerCatalogService catalog) {
        this.messages = messages;
        this.catalog = catalog;
    }
    public StickerCatalogService.StickerArtworkView artwork(UUID actor, UUID conversationId, String bucket, UUID messageId) {
        var message = messages.getMessage(actor, conversationId, bucket, messageId);
        if (Boolean.TRUE.equals(message.isDeleted()) || !"STICKER".equals(message.messageType()) || message.stickerId() == null)
            throw new NotFoundException("message sticker artwork not found");
        return catalog.historicalArtwork(message.stickerId());
    }
}
