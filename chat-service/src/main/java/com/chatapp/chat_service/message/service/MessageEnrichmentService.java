package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageAttachmentDto;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.dto.ReplyToDto;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.mapper.MessageMapper;
import com.chatapp.chat_service.message.repository.MessageMentionRepository;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.poll.dto.PollDto;
import com.chatapp.chat_service.poll.service.MessagePollService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.chatapp.chat_service.friendship.entity.Friendship;

/**
 * Service dedicated to enriching messages with external data (Users, Reactions, Attachments, etc.)
 * Handled in batch to avoid N+1 query problems and improve performance.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageEnrichmentService {

    private final MessageMapper messageMapper;
    private final MessageEnhancementService enhancementService;
    private final MessageMentionRepository messageMentionRepository;
    private final MessageRepository messageRepository;
    private final UserService userService;
    private final MessagePollService pollService;
    private final FriendshipRepository friendshipRepository;

    /**
     * Converts a list of Message entities to MessageResponseDto with Batch Enrichment
     */
    public List<MessageResponseDto> enrichMessages(UUID conversationId, List<Message> messages, UUID currentUserId) {
        if (messages == null || messages.isEmpty()) return Collections.emptyList();

        List<UUID> messageIds = messages.stream().map(m -> m.getKey().getMessageId()).collect(Collectors.toList());
        
        Set<UUID> userIds = messages.stream().map(Message::getSenderId).collect(Collectors.toSet());
        Map<UUID, UserDTO> usersMap = userService.getUserDetailsMap(userIds);

        Map<UUID, List<AggregatedReactionDto>> reactionsMap = enhancementService.getReactionsForMessages(conversationId, messageIds, currentUserId);
        Map<UUID, List<MessageAttachmentDto>> attachmentsMap = enhancementService.getAttachmentsForMessages(conversationId, messageIds);

        Map<UUID, List<String>> mentionsByMessage = messageMentionRepository.findByKeyConversationIdAndKeyMessageIdIn(conversationId, messageIds)
                .stream()
                .collect(Collectors.groupingBy(
                        m -> m.getKey().getMessageId(),
                        Collectors.mapping(m -> m.getKey().getMentionedUserId().toString(), Collectors.toList())
                ));

        List<UUID> replyIds = messages.stream()
                .map(Message::getReplyTo)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
        
        Map<UUID, ReplyToDto> repliesMap = new HashMap<>();
        if (!replyIds.isEmpty()) {
            Map<UUID, Message> replyMessages = messageRepository.findByConversationIdAndMessageIdIn(conversationId, replyIds).stream()
                    .collect(Collectors.toMap(m -> m.getKey().getMessageId(), m -> m));
            
            replyMessages.forEach((id, m) -> {
                UserDTO replySender = usersMap.get(m.getSenderId());
                if (replySender == null) {
                    replySender = userService.getUserById(m.getSenderId());
                }
                
                repliesMap.put(id, ReplyToDto.builder()
                        .messageId(id)
                        .content(m.isDeleted() ? "Message deleted" : m.getContent())
                        .sender(replySender)
                        .build());
            });
        }
        
        Map<UUID, PollDto> pollsMap = messages.stream()
                .filter(m -> "POLL".equalsIgnoreCase(m.getType()) && m.getContent() != null && !m.getContent().isEmpty())
                .parallel() 
                .map(m -> {
                    UUID messageId = m.getKey().getMessageId();
                    UUID conversationIdLocal = m.getKey().getConversationId();
                    try {
                        UUID pollId = UUID.fromString(m.getContent().trim());
                        PollDto rawDto = pollService.getPollResults(pollId, currentUserId);
                        PollDto dto;
                        if (rawDto == null) {
                            log.warn("Poll service returned null for poll {} (message {}), inserting placeholder", pollId, messageId);
                            dto = createMissingPollPlaceholder(pollId, conversationIdLocal, messageId);
                        } else {
                            dto = PollDto.builder()
                                    .pollId(rawDto.getPollId())
                                    .conversationId(rawDto.getConversationId())
                                    .messageId(rawDto.getMessageId())
                                    .question(rawDto.getQuestion())
                                    .options(rawDto.getOptions() != null ? new ArrayList<>(rawDto.getOptions()) : Collections.emptyList())
                                    .isClosed(rawDto.isClosed())
                                    .isMultipleChoice(rawDto.isMultipleChoice())
                                    .isAnonymous(rawDto.isAnonymous())
                                    .createdBy(rawDto.getCreatedBy())
                                    .createdByUsername(rawDto.getCreatedByUsername())
                                    .createdAt(rawDto.getCreatedAt())
                                    .expiresAt(rawDto.getExpiresAt())
                                    .totalVotes(rawDto.getTotalVotes())
                                    .currentUserVotes(rawDto.getCurrentUserVotes() != null ? new ArrayList<>(rawDto.getCurrentUserVotes()) : Collections.emptyList())
                                    .targetUserId(rawDto.getTargetUserId())
                                    .build();
                        }
                        return Map.entry(messageId, dto);
                    } catch (IllegalArgumentException iae) {
                        log.warn("Unable to parse poll ID '{}' for message {}", m.getContent(), messageId);
                        UUID pollId = null;
                        try { pollId = UUID.fromString(m.getContent().trim()); } catch (Exception ignore) {}
                        return Map.entry(messageId, createMissingPollPlaceholder(pollId, conversationIdLocal, messageId));
                    } catch (Exception e) {
                        log.error("Error fetching poll results for message {}: {}", messageId, e.getMessage());
                        UUID pollId = null;
                        try { pollId = UUID.fromString(m.getContent().trim()); } catch (Exception ignore) {}
                        return Map.entry(messageId, createMissingPollPlaceholder(pollId, conversationIdLocal, messageId));
                    }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        // Batch load blocked user IDs for viewer
        Set<UUID> blockedUserIds = Collections.emptySet();
        if (currentUserId != null) {
            try {
                blockedUserIds = friendshipRepository
                        .findBlockedFriendships(currentUserId, org.springframework.data.domain.PageRequest.of(0, 500))
                        .getContent().stream()
                        .map(f -> f.getKey().getFriendId())
                        .collect(Collectors.toSet());
            } catch (Exception e) {
                log.warn("Failed to load blocked users for enrichment: {}", e.getMessage());
            }
        }
        final Set<UUID> finalBlockedIds = blockedUserIds;

        List<MessageResponseDto> responses = messages.stream()
                .map(m -> {
                    MessageResponseDto dto = messageMapper.toResponseDtoEnriched(
                            m,
                            usersMap.getOrDefault(m.getSenderId(), UserDTO.builder().userId(m.getSenderId()).displayName("Unknown").build()),
                            reactionsMap.getOrDefault(m.getKey().getMessageId(), new ArrayList<>()),
                            attachmentsMap.getOrDefault(m.getKey().getMessageId(), new ArrayList<>()),
                            mentionsByMessage.getOrDefault(m.getKey().getMessageId(), new ArrayList<>()),
                            repliesMap.get(m.getReplyTo()),
                            pollsMap.get(m.getKey().getMessageId()),
                            currentUserId
                    );
                    dto.setSenderBlockedByViewer(finalBlockedIds.contains(m.getSenderId()));
                    return dto;
                })
                .collect(Collectors.toList());

        Collections.reverse(responses);
        return responses;
    }

    /**
     * Build a minimal PollDto to indicate that poll data could not be loaded.
     */
    private PollDto createMissingPollPlaceholder(UUID pollId, UUID conversationId, UUID messageId) {
        return PollDto.builder()
                .pollId(pollId)
                .conversationId(conversationId)
                .messageId(messageId)
                .question("[Poll unavailable]")
                .options(Collections.emptyList())
                .isClosed(true)
                .isMultipleChoice(false)
                .isAnonymous(false)
                .totalVotes(0)
                .currentUserVotes(Collections.emptyList())
                .build();
    }
}
