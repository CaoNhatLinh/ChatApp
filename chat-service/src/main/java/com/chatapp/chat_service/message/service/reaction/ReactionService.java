package com.chatapp.chat_service.message.service.reaction;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageReactionDto;
import com.chatapp.chat_service.message.dto.ReactionDto;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageReaction;
import com.chatapp.chat_service.message.event.MessageReactionEvent;
import com.chatapp.chat_service.message.repository.MessageReactionRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.message.service.MessageValidationService;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactionService {

    private final MessageReactionRepository reactionRepository;
    private final MessageRepository messageRepository;
    private final MessageValidationService messageValidationService;
    private final UserService userService;
    private final KafkaEventProducer kafkaEventProducer;

    private static final Set<String> ALLOWED_EMOJIS = Set.of(
            "👍", "👎", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👏"
    );

    /**
     * Add a reaction to a message
     */
    @Transactional
    public MessageReactionDto addReaction(UUID conversationId, UUID messageId, String emoji, UUID userId) {
        // Validate emoji
        if (!ALLOWED_EMOJIS.contains(emoji)) {
            throw new BadRequestException("Invalid emoji. Allowed emojis: " + ALLOWED_EMOJIS);
        }

        // Check if user is member of conversation
        messageValidationService.validateMessagePermission(conversationId, userId);

        // Check if message exists
        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));

        // Check if user already reacted with this emoji
        List<MessageReaction> existingReactions = reactionRepository
                .findByConversationIdAndMessageIdAndEmoji(conversationId, messageId, emoji);

        boolean alreadyReacted = existingReactions.stream()
                .anyMatch(r -> r.getKey().getUserId().equals(userId));

        if (alreadyReacted) {
            throw new BadRequestException("You have already reacted with this emoji");
        }

        // Create reaction
        MessageReaction.MessageReactionKey key = new MessageReaction.MessageReactionKey(
                conversationId, messageId, emoji, userId);

        MessageReaction reaction = MessageReaction.builder()
                .key(key)
                .reactedAt(Instant.now())
                .build();

        reactionRepository.save(reaction);

        // Publish event
        MessageReactionEvent event = MessageReactionEvent.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .emoji(emoji)
                .userId(userId)
                .action("ADD")
                .timestamp(Instant.now())
                .build();

        kafkaEventProducer.publishMessageReactionEvent(event);

        log.info("User {} added reaction {} to message {} in conversation {}", userId, emoji, messageId, conversationId);

        return toReactionDto(reaction, userId);
    }

    /**
     * Remove a reaction from a message
     */
    @Transactional
    public void removeReaction(UUID conversationId, UUID messageId, String emoji, UUID userId) {
        // Check if user is member of conversation
        messageValidationService.validateMessagePermission(conversationId, userId);

        // Check if reaction exists
        List<MessageReaction> reactions = reactionRepository
                .findByConversationIdAndMessageIdAndEmoji(conversationId, messageId, emoji);

        boolean hasReacted = reactions.stream()
                .anyMatch(r -> r.getKey().getUserId().equals(userId));

        if (!hasReacted) {
            throw new BadRequestException("You have not reacted with this emoji");
        }

        // Delete reaction
        reactionRepository.deleteByConversationIdAndMessageIdAndEmojiAndUserId(
                conversationId, messageId, emoji, userId);

        // Publish event
        MessageReactionEvent event = MessageReactionEvent.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .emoji(emoji)
                .userId(userId)
                .action("REMOVE")
                .timestamp(Instant.now())
                .build();

        kafkaEventProducer.publishMessageReactionEvent(event);

        log.info("User {} removed reaction {} from message {} in conversation {}", userId, emoji, messageId, conversationId);
    }

    /**
     * Get all reactions for a message
     */
    public List<AggregatedReactionDto> getMessageReactions(UUID conversationId, UUID messageId) {
        // Check if user is member of conversation
        UUID currentUserId = getCurrentUserId();
        if (currentUserId != null) {
            messageValidationService.validateMessagePermission(conversationId, currentUserId);
        }

        List<MessageReaction> reactions = reactionRepository
                .findByConversationIdAndMessageId(conversationId, messageId);

        // Aggregate by emoji
        Map<String, List<MessageReaction>> groupedByEmoji = reactions.stream()
                .collect(Collectors.groupingBy(r -> r.getKey().getEmoji()));

        List<AggregatedReactionDto> aggregatedReactions = new ArrayList<>();

        for (Map.Entry<String, List<MessageReaction>> entry : groupedByEmoji.entrySet()) {
            String emoji = entry.getKey();
            List<MessageReaction> emojiReactions = entry.getValue();

            List<UUID> userIds = emojiReactions.stream()
                    .map(r -> r.getKey().getUserId())
                    .collect(Collectors.toList());

            List<UserDTO> users = userIds.stream()
                    .map(uid -> userService.getUserProfile(uid))
                    .collect(Collectors.toList());

            AggregatedReactionDto aggregated = AggregatedReactionDto.builder()
                    .emoji(emoji)
                    .count(emojiReactions.size())
                    .users(users)
                    .build();

            aggregatedReactions.add(aggregated);
        }

        return aggregatedReactions;
    }

    /**
     * Get reactions for multiple messages (batch)
     */
    public Map<UUID, List<AggregatedReactionDto>> getReactionsForMessages(UUID conversationId, List<UUID> messageIds) {
        List<MessageReaction> reactions = reactionRepository
                .findByConversationIdAndMessageIdIn(conversationId, messageIds);

        Map<UUID, List<MessageReaction>> reactionsByMessage = reactions.stream()
                .collect(Collectors.groupingBy(r -> r.getKey().getMessageId()));

        Map<UUID, List<AggregatedReactionDto>> result = new HashMap<>();

        for (UUID messageId : messageIds) {
            List<MessageReaction> messageReactions = reactionsByMessage.getOrDefault(messageId, Collections.emptyList());

            Map<String, List<MessageReaction>> groupedByEmoji = messageReactions.stream()
                    .collect(Collectors.groupingBy(r -> r.getKey().getEmoji()));

            List<AggregatedReactionDto> aggregatedReactions = new ArrayList<>();

            for (Map.Entry<String, List<MessageReaction>> entry : groupedByEmoji.entrySet()) {
                String emoji = entry.getKey();
                List<MessageReaction> emojiReactions = entry.getValue();

                List<UUID> userIds = emojiReactions.stream()
                        .map(r -> r.getKey().getUserId())
                        .collect(Collectors.toList());

                List<UserDTO> users = userIds.stream()
                        .map(uid -> userService.getUserProfile(uid))
                        .collect(Collectors.toList());

                AggregatedReactionDto aggregated = AggregatedReactionDto.builder()
                        .emoji(emoji)
                        .count(emojiReactions.size())
                        .users(users)
                        .build();

                aggregatedReactions.add(aggregated);
            }

            result.put(messageId, aggregatedReactions);
        }

        return result;
    }

    private MessageReactionDto toReactionDto(MessageReaction reaction, UUID currentUserId) {
        UserDTO user = userService.getUserProfile(reaction.getKey().getUserId());

        return MessageReactionDto.builder()
                .messageId(reaction.getKey().getMessageId())
                .emoji(reaction.getKey().getEmoji())
                .createdAt(reaction.getReactedAt() != null ? reaction.getReactedAt().toString() : null)
                .user(user)
                .build();
    }

    private UUID getCurrentUserId() {
        // This should be implemented using SecurityContextHelper
        // For now, return null as a placeholder
        return null;
    }
}
