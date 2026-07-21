package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.conversation.repository.ConversationRepository;
import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.conversation.entity.ConversationMembers;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service validation cho message operations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageValidationService {
    
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationRepository conversationRepository;
    private final FriendshipRepository friendshipRepository;
    
    /**
     * Kiểm tra user có phải member của conversation không
     * @param conversationId ID của conversation
     * @param userId ID của user
     * @throws ForbiddenException nếu user không phải member
     */
    public void validateConversationMembership(UUID conversationId, UUID userId) {
        if (!conversationMemberRepository.existsByKeyConversationIdAndKeyUserId(conversationId, userId)) {
            throw new ForbiddenException("You are not a member of this conversation");
        }
    }
    
    /**
     * Kiểm tra user có quyền gửi message không
     * @param conversationId ID của conversation
     * @param userId ID của user
     * @throws ForbiddenException nếu user không có quyền
     */
    public void validateMessagePermission(UUID conversationId, UUID userId) {
        validateConversationMembership(conversationId, userId);
        
        Conversation conversation = conversationRepository.findByConversationId(conversationId)
                .orElseThrow(() -> new ForbiddenException("Conversation not found"));
        
        if ("dm".equals(conversation.getType())) {
            var members = conversationMemberRepository.findAllByKeyConversationId(conversationId);
            UUID otherUserId = members.stream()
                    .map(m -> m.getKey().getUserId())
                    .filter(id -> !id.equals(userId))
                    .findFirst()
                    .orElse(null);
            
            if (otherUserId != null) {
                var outRel = friendshipRepository.findByUserAndFriend(userId, otherUserId);
                if (outRel.isPresent() && outRel.get().getStatus() == Friendship.Status.BLOCKED) {
                    throw new ForbiddenException("You have blocked this user. Unblock them to send a message.");
                }
                
                var inRel = friendshipRepository.findByUserAndFriend(otherUserId, userId);
                if (inRel.isPresent() && inRel.get().getStatus() == Friendship.Status.BLOCKED) {
                    throw new ForbiddenException("You have been blocked by this user.");
                }
            }
        }
    }

    /**
     * Lấy tất cả conversationId mà user được tham gia
     * @param userId ID cá»§a user
     * @return danh sách ID cuộc trao trao
     */
    public List<UUID> getConversationIdsForUser(UUID userId) {
        List<ConversationMembers> memberships = conversationMemberRepository.findByUserId(userId);
        return memberships.stream()
                .map(member -> member.getKey().getConversationId())
                .distinct()
                .collect(Collectors.toList());
    }

    public List<UUID> getConversationIdsForUsers(UUID firstUserId, UUID secondUserId) {
        Set<UUID> firstUserConversationIds = conversationMemberRepository.findByUserId(firstUserId).stream()
                .map(member -> member.getKey().getConversationId())
                .collect(Collectors.toSet());

        if (firstUserConversationIds.isEmpty()) {
            return List.of();
        }

        return conversationMemberRepository.findByUserId(secondUserId).stream()
                .map(member -> member.getKey().getConversationId())
                .filter(firstUserConversationIds::contains)
                .distinct()
                .toList();
    }

    public List<UUID> getConversationIdsForDmWithRecipient(UUID currentUserId, UUID recipientUserId) {
        return getConversationIdsForUsers(currentUserId, recipientUserId).stream()
                .filter(conversationId -> {
                    Conversation conversation = conversationRepository.findByConversationId(conversationId)
                            .orElse(null);
                    return conversation != null && "dm".equals(conversation.getType());
                })
                .toList();
    }
}
