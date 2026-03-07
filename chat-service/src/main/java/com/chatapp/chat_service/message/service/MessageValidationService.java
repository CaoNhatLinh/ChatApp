package com.chatapp.chat_service.message.service;

import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.conversation.repository.ConversationRepository;
import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.chatapp.chat_service.friendship.entity.Friendship;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

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
}
