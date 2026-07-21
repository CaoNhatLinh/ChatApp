package com.chatapp.chat_service.message.service.pin;

import com.chatapp.chat_service.message.entity.PinnedMessage;
import com.chatapp.chat_service.message.repository.PinnedMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PinService {

    private final PinnedMessageRepository pinnedMessageRepository;

    /**
     * Pin a message in a conversation
     */
    public void pinMessage(UUID conversationId, UUID messageId, UUID pinnedBy) {
        PinnedMessage.PinnedMessageKey key = new PinnedMessage.PinnedMessageKey(
                conversationId, messageId);

        // Check if already pinned
        if (pinnedMessageRepository.findById(key).isPresent()) {
            log.info("Message {} in conversation {} is already pinned", messageId, conversationId);
            return;
        }

        PinnedMessage pinnedMessage = PinnedMessage.builder()
                .key(key)
                .pinnedAt(Instant.now())
                .pinnedBy(pinnedBy)
                .build();

        pinnedMessageRepository.save(pinnedMessage);
        log.info("Message {} in conversation {} pinned by user {}", messageId, conversationId, pinnedBy);
    }

    /**
     * Unpin a message in a conversation
     */
    public void unpinMessage(UUID conversationId, UUID messageId) {
        PinnedMessage.PinnedMessageKey key = new PinnedMessage.PinnedMessageKey(
                conversationId, messageId);

        pinnedMessageRepository.deleteById(key);
        log.info("Message {} in conversation {} unpinned", messageId, conversationId);
    }

    /**
     * Toggle pin status of a message
     */
    public void togglePinMessage(UUID conversationId, UUID messageId, UUID pinnedBy) {
        PinnedMessage.PinnedMessageKey key = new PinnedMessage.PinnedMessageKey(
                conversationId, messageId);

        if (pinnedMessageRepository.findById(key).isPresent()) {
            unpinMessage(conversationId, messageId);
        } else {
            pinMessage(conversationId, messageId, pinnedBy);
        }
    }

    /**
     * Get all pinned messages in a conversation
     */
    public List<PinnedMessage> getPinnedMessages(UUID conversationId) {
        return pinnedMessageRepository.findByKeyConversationId(conversationId);
    }

    /**
     * Check if a message is pinned
     */
    public boolean isMessagePinned(UUID conversationId, UUID messageId) {
        PinnedMessage.PinnedMessageKey key = new PinnedMessage.PinnedMessageKey(
                conversationId, messageId);
        return pinnedMessageRepository.findById(key).isPresent();
    }
}
