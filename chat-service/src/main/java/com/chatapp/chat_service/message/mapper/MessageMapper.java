package com.chatapp.chat_service.message.mapper;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.message.dto.AggregatedReactionDto;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.dto.MessageSummary;
import com.chatapp.chat_service.message.dto.ReplyToDto;
import com.chatapp.chat_service.poll.dto.PollDto;
import com.chatapp.chat_service.message.entity.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Mapper for converting Message entities to DTOs.
 * Designed as a pure transformation component where possible.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessageMapper {
    
    private final UserService userService;

    /**
     * Converts Message to a simple summary DTO.
     */
    public MessageSummary toSummary(Message message) {
        return MessageSummary.builder()
                .messageId(message.getKey().getMessageId())
                .senderId(message.getSenderId())
                .content(message.getContent())
                .createdAt(message.getCreatedAt())
                .build();
    }

    /**
     * Standard conversion for a single message.
     * Note: This performs one DB hit to fetch sender details.
     */
    public MessageResponseDto toResponseDto(Message message, UUID currentUserId) {
        return toResponseDtoEnriched(
                message,
                createSenderDto(message.getSenderId()),
                new ArrayList<>(),
                new ArrayList<>(),
                new ArrayList<>(),
                null,
                null,
                currentUserId
        );
    }

    /**
     * Enriched conversion using pre-fetched data to avoid N+1 queries.
     */
    public MessageResponseDto toResponseDtoEnriched(
            Message message,
            UserDTO sender,
            List<AggregatedReactionDto> reactions,
            List<com.chatapp.chat_service.message.dto.MessageAttachmentDto> attachments,
            List<String> mentionedUserIds,
            ReplyToDto replyTo,
            PollDto poll,
            UUID currentUserId) {
        
        UUID messageId = message.getKey().getMessageId();
        UUID conversationId = message.getKey().getConversationId();

        return MessageResponseDto.builder()
                .messageId(messageId)
                .conversationId(conversationId)
                .content(message.getContent())
                .sender(sender)
                .mentionedUsers(mentionedUserIds)
                .messageType(message.getType() != null ? message.getType() : "TEXT")
                .attachments(attachments)
                .images(new ArrayList<>()) 
                .reactions(reactions != null ? reactions : new ArrayList<>())
                .replyTo(replyTo)
                .replyType(replyTo != null ? "Message" : null)
                .poll(poll)
                .isForwarded(false)
                .isDeleted(message.isDeleted())
                .createdAt(message.getCreatedAt())
                .updatedAt(message.getEditedAt())
                .fileAttachments(new ArrayList<>())
                .build();
    }

    private UserDTO toUserDTO(User user) {
        return UserDTO.builder()
                .userId(user.getUserId())
                .userName(user.getUsername())
                .displayName(user.getDisplayName())
                .avatarUrl(user.getAvatarUrl())
                .build();
    }

    private UserDTO createSenderDto(UUID senderId) {
        return userService.findById(senderId)
                .map(this::toUserDTO)
                .orElse(UserDTO.builder()
                        .userId(senderId)
                        .displayName("Unknown User")
                        .userName("unknown_" + senderId.toString().substring(0, 8))
                        .avatarUrl(null)
                        .build());
    }
}