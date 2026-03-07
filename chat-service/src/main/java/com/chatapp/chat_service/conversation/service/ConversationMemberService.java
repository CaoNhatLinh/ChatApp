package com.chatapp.chat_service.conversation.service;
import com.chatapp.chat_service.auth.entity.User;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.conversation.dto.ConversationMemberDto;
import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.conversation.entity.ConversationMembers;
import com.chatapp.chat_service.conversation.entity.UserConversation;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.conversation.repository.ConversationRepository;
import com.chatapp.chat_service.conversation.repository.UserConversationRepository;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConversationMemberService {
    private static final Logger logger = LoggerFactory.getLogger(ConversationMemberService.class);
    
    private final ConversationMemberRepository memberRepository;
    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;
    private final UserConversationRepository userConversationRepository;
    
    /**
     * Lấy danh sách members của conversation với thông tin chi tiết (Phân trang)
     */
    public org.springframework.data.domain.Slice<ConversationMemberDto> getConversationMembers(UUID conversationId, org.springframework.data.domain.Pageable pageable) {
        org.springframework.data.domain.Slice<ConversationMembers> memberSlice = memberRepository.findByKeyConversationId(conversationId, pageable);
        
        List<ConversationMemberDto> dtos = memberSlice.getContent().stream()
                .map(this::toMemberDto)
                .collect(Collectors.toList());
                
        return new org.springframework.data.domain.SliceImpl<>(dtos, pageable, memberSlice.hasNext());
    }
    
    /**
     * Thêm members vào conversation
     * Chỉ owner và admin mới được thực hiện
     */
    public void addMembers(UUID conversationId, List<UUID> memberIds, UUID requesterId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        checkPermission(conversationId, requesterId, List.of("owner", "admin"));
        
        Instant now = Instant.now();
        List<ConversationMembers> newMembers = memberIds.stream()
                .filter(memberId -> !isMemberOfConversation(conversationId, memberId))
                .map(memberId -> ConversationMembers.builder()
                        .key(new ConversationMembers.ConversationMemberKey(conversationId, memberId))
                        .role("member")
                        .joinedAt(now)
                        .build())
                .collect(Collectors.toList());
        
        memberRepository.saveAll(newMembers);
        
        List<UserConversation> userConvs = newMembers.stream()
                .map(m -> UserConversation.builder()
                        .key(UserConversation.UserConversationKey.builder()
                                .userId(m.getKey().getUserId())
                                .isPinned(false)
                                .lastActivityAt(now)
                                .conversationId(conversationId)
                                .build())
                        .joinedAt(now)
                        .role(m.getRole())
                        .build())
                .collect(Collectors.toList());
        userConversationRepository.saveAll(userConvs);
        
        logger.info("Added {} members to conversation {} by user {}", 
                newMembers.size(), conversationId, requesterId);
    }
    
    /**
     * Kick member khỏi conversation
     * Chỉ owner và admin mới được thực hiện
     * Không thể kick owner
     */
    public void removeMember(UUID conversationId, UUID memberIdToRemove, UUID requesterId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        checkPermission(conversationId, requesterId, List.of("owner", "admin"));
        
        ConversationMembers memberToRemove = getMemberOrThrow(conversationId, memberIdToRemove);
        
        if ("owner".equals(memberToRemove.getRole())) {
            throw new ForbiddenException("Không thể kick chủ phòng");
        }
        
        String requesterRole = getMemberRole(conversationId, requesterId);
        if ("admin".equals(requesterRole) && "admin".equals(memberToRemove.getRole())) {
            throw new ForbiddenException("Admin không thể kick admin khác");
        }
        
        memberRepository.delete(memberToRemove);
        
        deleteUserConversation(memberIdToRemove, conversationId);
        
        logger.info("Removed member {} from conversation {} by user {}", 
                memberIdToRemove, conversationId, requesterId);
    }
    
    /**
     * Chuyển quyền owner cho member khác
     * Chỉ owner hiện tại mới được thực hiện
     */
    public void transferOwnership(UUID conversationId, UUID newOwnerId, UUID currentOwnerId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        checkPermission(conversationId, currentOwnerId, List.of("owner"));
        
        ConversationMembers newOwnerMember = getMemberOrThrow(conversationId, newOwnerId);
        ConversationMembers currentOwnerMember = getMemberOrThrow(conversationId, currentOwnerId);
        
        newOwnerMember.setRole("owner");
        currentOwnerMember.setRole("admin"); 
        
        memberRepository.save(newOwnerMember);
        memberRepository.save(currentOwnerMember);
        
        updateUserConversationRole(newOwnerId, conversationId, "owner");
        updateUserConversationRole(currentOwnerId, conversationId, "admin");
        
        conversation.setCreatedBy(newOwnerId);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        
        logger.info("Transferred ownership of conversation {} from {} to {}", 
                conversationId, currentOwnerId, newOwnerId);
    }
    
    /**
     * Trao quyền admin cho member
     * Chỉ owner mới được thực hiện
     */
    public void grantAdmin(UUID conversationId, UUID userId, UUID ownerId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        checkPermission(conversationId, ownerId, List.of("owner"));
        
        ConversationMembers member = getMemberOrThrow(conversationId, userId);
        
        if ("owner".equals(member.getRole())) {
            throw new BadRequestException("Người dùng này đã là chủ phòng");
        }
        
        member.setRole("admin");
        memberRepository.save(member);
        
        updateUserConversationRole(userId, conversationId, "admin");
        
        logger.info("Granted admin role to user {} in conversation {} by owner {}", 
                userId, conversationId, ownerId);
    }
    
    /**
     * Thu hồi quyền admin
     * Chỉ owner mới được thực hiện
     */
    public void revokeAdmin(UUID conversationId, UUID userId, UUID ownerId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        checkPermission(conversationId, ownerId, List.of("owner"));
        
        ConversationMembers member = getMemberOrThrow(conversationId, userId);
        
        if (!"admin".equals(member.getRole())) {
            throw new BadRequestException("Người dùng này không phải là admin");
        }
        
        member.setRole("member");
        memberRepository.save(member);
        
        updateUserConversationRole(userId, conversationId, "member");
        
        logger.info("Revoked admin role from user {} in conversation {} by owner {}", 
                userId, conversationId, ownerId);
    }
    
    /**
     * Rời khỏi conversation
     * Owner không được phép rời (phải chuyển quyền trước)
     */
    public void leaveConversation(UUID conversationId, UUID userId) {
        Conversation conversation = getConversationOrThrow(conversationId);
        
        ConversationMembers member = getMemberOrThrow(conversationId, userId);
        
        if ("owner".equals(member.getRole())) {
            throw new ForbiddenException("Chủ phòng không thể rời khỏi phòng. Vui lòng chuyển quyền chủ phòng trước.");
        }
        
        memberRepository.delete(member);
        
        deleteUserConversation(userId, conversationId);
        
        logger.info("User {} left conversation {}", userId, conversationId);
    }
    
    /**
     * Kiểm tra user có phải là member của conversation không
     */
    public boolean isMemberOfConversation(UUID conversationId, UUID userId) {
        return memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).isPresent();
    }
    
    /**
     * Lấy role của user trong conversation
     */
    public String getMemberRole(UUID conversationId, UUID userId) {
        return memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).map(ConversationMembers::getRole)
         .orElse(null);
    }
    
    
    /**
     * Delete UserConversation record for a user leaving/kicked from a conversation.
     * Must find-then-delete because Cassandra requires full primary key for deletion.
     */
    private void deleteUserConversation(UUID userId, UUID conversationId) {
        try {
            userConversationRepository.findByUserIdAndConversationId(userId, conversationId)
                    .ifPresent(userConversationRepository::delete);
        } catch (Exception e) {
            logger.warn("Failed to delete UserConversation for user {} in conversation {}: {}",
                    userId, conversationId, e.getMessage());
        }
    }
    
    /**
     * Update role in UserConversation. Since role is a regular column (not part of PK),
     * we can update in place.
     */
    private void updateUserConversationRole(UUID userId, UUID conversationId, String newRole) {
        try {
            userConversationRepository.findByUserIdAndConversationId(userId, conversationId)
                    .ifPresent(uc -> {
                        uc.setRole(newRole);
                        userConversationRepository.save(uc);
                    });
        } catch (Exception e) {
            logger.warn("Failed to update UserConversation role for user {} in conversation {}: {}",
                    userId, conversationId, e.getMessage());
        }
    }
    
    
    private Conversation getConversationOrThrow(UUID conversationId) {
        return conversationRepository.findByConversationId(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation không tồn tại"));
    }
    
    private ConversationMembers getMemberOrThrow(UUID conversationId, UUID userId) {
        return memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).orElseThrow(() -> new NotFoundException("User không phải là member của conversation này"));
    }
    
    private void checkPermission(UUID conversationId, UUID userId, List<String> allowedRoles) {
        String role = getMemberRole(conversationId, userId);
        
        if (role == null) {
            throw new ForbiddenException("Bạn không phải là member của conversation này");
        }
        
        if (!allowedRoles.contains(role)) {
            throw new ForbiddenException("Bạn không có quyền thực hiện hành động này");
        }
    }
    
    private ConversationMemberDto toMemberDto(ConversationMembers member) {
        UUID userId = member.getUserId();
        
        Optional<User> userOpt = userRepository.findById(userId);
        
        ConversationMemberDto.ConversationMemberDtoBuilder builder = ConversationMemberDto.builder()
                .userId(userId)
                .conversationId(member.getConversationId())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt());
        
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            builder.username(user.getUsername())
                   .displayName(user.getDisplayName())
                   .avatarUrl(user.getAvatarUrl());
        }
        
        builder.isOnline(false);
        
        return builder.build();
    }
}

