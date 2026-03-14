package com.chatapp.chat_service.conversation.service;

import com.chatapp.chat_service.redis.publisher.RedisCacheEvictPublisher;
import com.chatapp.chat_service.elasticsearch.service.ConversationElasticsearchService;
import com.chatapp.chat_service.auth.service.UserService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.conversation.dto.ConversationRequest;
import com.chatapp.chat_service.conversation.dto.ConversationResponseDto;
import com.chatapp.chat_service.conversation.dto.ConversationSearchDto;
import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.conversation.entity.ConversationMembers;
import com.chatapp.chat_service.conversation.exception.ConversationAlreadyExistsException;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.conversation.repository.ConversationRepository;
import com.chatapp.chat_service.conversation.repository.UserConversationRepository;
import com.chatapp.chat_service.conversation.entity.UserConversation;
import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.entity.MessageReadReceipt;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.message.repository.MessageReadReceiptRepository;
import com.chatapp.chat_service.common.exception.BusinessException;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private static final int MAX_PINNED_CONVERSATIONS = 5;
    private static final Logger logger = LoggerFactory.getLogger(ConversationService.class);
    private static final Duration CACHE_TTL = Duration.ofHours(1);
    
    private final RedisTemplate<String, Object> redisTemplate;
    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository memberRepository;
    private final UserConversationRepository userConversationRepository;
    private final RedisCacheEvictPublisher cacheEvictPublisher;
    private final UserService userService;
    private final MessageRepository messageRepository;
    private final MessageReadReceiptRepository messageReadReceiptRepository;
    
    @Autowired(required = false)
    private ConversationElasticsearchService conversationElasticsearchService;

    public ConversationService(
            RedisTemplate<String, Object> redisTemplate,
            ConversationRepository conversationRepository,
            ConversationMemberRepository memberRepository,
            UserConversationRepository userConversationRepository,
            RedisCacheEvictPublisher cacheEvictPublisher,
            UserService userService,
            MessageRepository messageRepository,
            MessageReadReceiptRepository messageReadReceiptRepository) {
        this.redisTemplate = redisTemplate;
        this.conversationRepository = conversationRepository;
        this.memberRepository = memberRepository;
        this.userConversationRepository = userConversationRepository;
        this.cacheEvictPublisher = cacheEvictPublisher;
        this.userService = userService;
        this.messageRepository = messageRepository;
        this.messageReadReceiptRepository = messageReadReceiptRepository;
    }

    public org.springframework.data.domain.Slice<UserConversation> getUserConversations(UUID userId, Pageable pageable) {
        return userConversationRepository.findByUserId(userId, pageable);
    }

    public Conversation createConversation(ConversationRequest req, UUID createdId) {
        if ("dm".equals(req.getType())) {
            validateDmConversation(req, createdId);
        }
        
        UUID conversationId = UUID.randomUUID();
        Instant now = Instant.now();

        Conversation conversation = Conversation.builder()
                .conversationId(conversationId)
                .type(req.getType())
                .name(req.getName())
                .description(req.getDescription())
                .isDeleted(false)
                .createdBy(createdId)
                .createdAt(now)
                .updatedAt(now)
                .build();

        conversationRepository.save(conversation);

        Set<UUID> allMembers = new HashSet<>(req.getMemberIds());
        allMembers.add(createdId);
        
        List<ConversationMembers> members = allMembers.stream()
                .map(userId -> ConversationMembers.builder()
                        .key(new ConversationMembers.ConversationMemberKey(conversationId, userId))
                        .role(userId.equals(createdId) ? "owner" : "member")
                        .joinedAt(now)
                        .build())
                .toList();

        memberRepository.saveAll(members);

        List<UserConversation> userConvs = allMembers.stream()
                .map(userId -> UserConversation.builder()
                        .key(UserConversation.UserConversationKey.builder()
                                .userId(userId)
                                .isPinned(false)
                                .lastActivityAt(now)
                                .conversationId(conversationId)
                                .build())
                        .joinedAt(now)
                        .role(userId.equals(createdId) ? "owner" : "member")
                        .build())
                .toList();
        userConversationRepository.saveAll(userConvs);

        indexConversationToElasticsearch(conversation);
        
        if ("dm".equals(req.getType()) && allMembers.size() == 2) {
            cachePrivateConversation(allMembers, conversation);
        }

        logger.info("Created {} conversation {} by user {}", req.getType(), conversationId, createdId);
        return conversation;
    }

    private void validateDmConversation(ConversationRequest req, UUID createdId) {
        if (req.getMemberIds().size() != 1) {
            throw new BadRequestException("DM conversation must have exactly 2 members (creator + 1 member)");
        }
        
        UUID otherUserId = req.getMemberIds().get(0);
        if (createdId.equals(otherUserId)) {
            throw new BadRequestException("Cannot create DM conversation with yourself");
        }
        
        Optional<Conversation> existingDM = findPrivateConversationWithCache(createdId, otherUserId);
        if (existingDM.isPresent()) {
            throw new ConversationAlreadyExistsException("DM conversation already exists between these users");
        }
    }

    private void cachePrivateConversation(Set<UUID> memberIds, Conversation conversation) {
        List<UUID> sortedUserIds = new ArrayList<>(memberIds);
        Collections.sort(sortedUserIds);

        String cacheKey = String.format("dmChat:%s:%s", sortedUserIds.get(0), sortedUserIds.get(1));
        redisTemplate.opsForValue().set(cacheKey, conversation, CACHE_TTL);
    }

    public Optional<Conversation> getConversationById(UUID conversationId) {
        return conversationRepository.findByConversationId(conversationId)
                .filter(c -> !c.isDeleted());
    }

    public Optional<Conversation> findPrivateConversation(UUID userId1, UUID userId2) {
        List<UUID> user1Conversations = memberRepository.findConversationIdsByUserId(userId1);
        List<UUID> user2Conversations = memberRepository.findConversationIdsByUserId(userId2);

        Set<UUID> commonConversations = new HashSet<>(user1Conversations);
        commonConversations.retainAll(user2Conversations);

        for (UUID conversationId : commonConversations) {
            Optional<Conversation> conversation = conversationRepository.findByConversationId(conversationId);
            if (conversation.isPresent() && 
                !conversation.get().isDeleted() && 
                "dm".equals(conversation.get().getType())) {
                return conversation;
            }
        }
        return Optional.empty();
    }

    public boolean deleteConversation(UUID conversationId, UUID userId) {
        Optional<Conversation> conversationOpt = conversationRepository.findByConversationId(conversationId);
        
        if (conversationOpt.isEmpty() || conversationOpt.get().isDeleted()) {
            return false;
        }
        
        Conversation conversation = conversationOpt.get();
        
        ConversationMembers member = memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).orElseThrow(() -> new ForbiddenException("You are not a member of this conversation"));
        
        String role = member.getRole();
        if (!"owner".equals(role) && !"admin".equals(role)) {
            throw new ForbiddenException("Only owner and admin can delete this conversation");
        }
        
        conversation.setDeleted(true);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        
        if (conversationElasticsearchService != null) {
            conversationElasticsearchService.deleteConversation(conversationId);
        }
        
        clearConversationCache(conversationId, conversation);
        logger.info("Soft deleted conversation {} by user {}", conversationId, userId);
        return true;
    }
    
    public boolean restoreConversation(UUID conversationId, UUID userId) {
        Optional<Conversation> conversationOpt = conversationRepository.findByConversationId(conversationId);
        
        if (conversationOpt.isEmpty()) {
            return false;
        }
        
        Conversation conversation = conversationOpt.get();
        
        ConversationMembers member = memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).orElseThrow(() -> new ForbiddenException("You are not a member of this conversation"));
        
        String role = member.getRole();
        if (!"owner".equals(role) && !"admin".equals(role)) {
            throw new ForbiddenException("Only owner and admin can restore this conversation");
        }
        
        conversation.setDeleted(false);
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        
        if (conversationElasticsearchService != null) {
            conversationElasticsearchService.restoreConversation(conversationId);
        }
        
        logger.info("Restored conversation {} by user {}", conversationId, userId);
        return true;
    }

    /**
     * Permanently delete a conversation — removes all data (conversation, members, user_conversations).
     * Only the owner can perform this action.
     */
    public boolean permanentDeleteConversation(UUID conversationId, UUID userId) {
        Optional<Conversation> conversationOpt = conversationRepository.findByConversationId(conversationId);
        
        if (conversationOpt.isEmpty()) {
            return false;
        }
        
        Conversation conversation = conversationOpt.get();
        
        ConversationMembers member = memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, userId)
        ).orElseThrow(() -> new ForbiddenException("You are not a member of this conversation"));
        
        if (!"owner".equals(member.getRole())) {
            throw new ForbiddenException("Only the owner can permanently delete this conversation");
        }
        
        List<UserConversation> userConvs = userConversationRepository.findByConversationId(conversationId);
        if (!userConvs.isEmpty()) {
            userConversationRepository.deleteAll(userConvs);
        }
        
        List<ConversationMembers> members = memberRepository.findAllByKeyConversationId(conversationId);
        if (!members.isEmpty()) {
            memberRepository.deleteAll(members);
        }
        
        conversationRepository.delete(conversation);
        
        if (conversationElasticsearchService != null) {
            conversationElasticsearchService.deleteConversation(conversationId);
        }
        
        clearConversationCache(conversationId, conversation);
        
        logger.info("Permanently deleted conversation {} by owner {}", conversationId, userId);
        return true;
    }

    public Optional<Conversation> findPrivateConversationWithCache(UUID userId1, UUID userId2) {
        List<UUID> sortedUserIds = Arrays.asList(userId1, userId2);
        Collections.sort(sortedUserIds);
        
        String cacheKey = String.format("dmChat:%s:%s", sortedUserIds.get(0), sortedUserIds.get(1));
        
        try {
            Object cachedConversation = redisTemplate.opsForValue().get(cacheKey);
            if (cachedConversation instanceof Conversation) {
                Conversation conversation = (Conversation) cachedConversation;
                if (!conversation.isDeleted()) {
                    return Optional.of(conversation);
                }
                redisTemplate.delete(cacheKey);
            }
        } catch (Exception e) {
            logger.warn("Error accessing cache for DM conversation: {}", e.getMessage());
        }
        
        Optional<Conversation> conversation = findPrivateConversation(userId1, userId2);
        conversation.ifPresent(c -> redisTemplate.opsForValue().set(cacheKey, c, CACHE_TTL));
        
        return conversation;
    }

    private void clearConversationCache(UUID conversationId, Conversation conversation) {
        String cacheKey = "conversation:" + conversationId;
        redisTemplate.delete(cacheKey);
        
        if ("dm".equals(conversation.getType())) {
            clearDmCache(conversationId);
        }
    }

    private void clearDmCache(UUID conversationId) {
        try {
            List<ConversationMembers> members = memberRepository.findAllByKeyConversationId(conversationId);
            
            if (members.size() == 2) {
                List<UUID> userIds = members.stream()
                        .map(m -> m.getKey().getUserId())
                        .sorted()
                        .toList();
                
                String dmCacheKey = String.format("dmChat:%s:%s", userIds.get(0), userIds.get(1));
                redisTemplate.delete(dmCacheKey);
                logger.debug("Cleared DM cache for conversation: {}", conversationId);
            }
        } catch (Exception e) {
            logger.warn("Error clearing DM cache for conversation {}: {}", conversationId, e.getMessage());
        }
    }

    public Page<ConversationSearchDto> searchConversations(UUID userId, String name, String type, Pageable pageable) {
        if (conversationElasticsearchService == null) {
            throw new UnsupportedOperationException("Search requires Elasticsearch to be enabled");
        }
        
        Page<ConversationDocument> documents = conversationElasticsearchService.searchConversations(userId, name, type, pageable);
        
        return documents.map(doc -> ConversationSearchDto.builder()
                .conversationId(doc.getConversationId())
                .name(doc.getName())
                .type(doc.getType())
                .description(doc.getDescription())
                .avatar(doc.getAvatar())
                .createdAt(doc.getCreatedAt())
                .lastMessage(doc.getLastMessage())
                .createdBy(doc.getCreatedBy())
                .memberCount(doc.getMemberCount())
                .memberIds(doc.getMemberIds())
                .build());
    }

    private void indexConversationToElasticsearch(Conversation conversation) {
        if (conversationElasticsearchService != null) {
            try {
                conversationElasticsearchService.indexConversation(conversation);
            } catch (Exception e) {
                logger.warn("Failed to index conversation to Elasticsearch: {}", conversation.getConversationId(), e);
            }
        }
    }

    public org.springframework.data.domain.Slice<ConversationResponseDto> getUserConversationsWithDetails(UUID userId, Pageable pageable) {
        org.springframework.data.domain.Slice<UserConversation> userConversations = getUserConversations(userId, pageable);
        
        if (userConversations.getContent().isEmpty() && pageable.getPageNumber() == 0) {
            List<ConversationMembers> memberEntries = memberRepository.findByUserId(userId);
            if (!memberEntries.isEmpty()) {
                logger.info("Self-healing: creating {} UserConversation records for user {}", memberEntries.size(), userId);
                Instant now = Instant.now();
                List<UserConversation> userConvs = memberEntries.stream()
                        .map(m -> {
                            Instant activityAt = m.getJoinedAt() != null ? m.getJoinedAt() : now;
                            return UserConversation.builder()
                                    .key(UserConversation.UserConversationKey.builder()
                                            .userId(userId)
                                            .isPinned(false)
                                            .lastActivityAt(activityAt)
                                            .conversationId(m.getKey().getConversationId())
                                            .build())
                                    .joinedAt(m.getJoinedAt() != null ? m.getJoinedAt() : now)
                                    .role(m.getRole() != null ? m.getRole() : "member")
                                    .build();
                        })
                        .toList();
                userConversationRepository.saveAll(userConvs);
                userConversations = getUserConversations(userId, pageable);
            }
        }
        
        List<ConversationResponseDto> dtos = userConversations.getContent().stream()
                .map(uc -> {
                    Optional<Conversation> convOpt = conversationRepository.findByConversationId(uc.getKey().getConversationId());
                    return convOpt.map(conversation -> buildConversationResponse(
                            conversation, 
                            userId, 
                            uc.getKey().isPinned(), 
                            uc.getKey().getLastActivityAt()
                    )).orElse(null);
                })
                .filter(Objects::nonNull)
                .toList();
        return new org.springframework.data.domain.SliceImpl<>(dtos, pageable, userConversations.hasNext());
    }

    /**
     * Build a ConversationResponseDto for a single conversation.
     * Looks up the user's membership info for pin/activity status.
     * Returns null if the user is not a member.
     */
    public ConversationResponseDto buildSingleConversationResponse(Conversation conversation, UUID userId) {
        Optional<UserConversation> userConvOpt = userConversationRepository.findByUserIdAndConversationId(userId, conversation.getConversationId());
        if (userConvOpt.isEmpty()) {
            Optional<ConversationMembers> memberOpt = memberRepository.findById(
                    new ConversationMembers.ConversationMemberKey(conversation.getConversationId(), userId));
            if (memberOpt.isEmpty()) {
                return null; 
            }
            return buildConversationResponse(conversation, userId, false, conversation.getUpdatedAt());
        }
        UserConversation uc = userConvOpt.get();
        return buildConversationResponse(conversation, userId, uc.getKey().isPinned(), uc.getKey().getLastActivityAt());
    }

    private ConversationResponseDto buildConversationResponse(Conversation conversation, UUID currentUserId, boolean isPinned, Instant lastActivityAt) {
        ConversationResponseDto.ConversationResponseDtoBuilder builder = ConversationResponseDto.builder()
                .conversationId(conversation.getConversationId())
                .type(conversation.getType())
                .description(conversation.getDescription())
                .createdBy(conversation.getCreatedBy())
                .backgroundUrl(conversation.getBackgroundUrl())
                .createdAt(conversation.getCreatedAt())
                .updatedAt(conversation.getUpdatedAt())
                .isDeleted(conversation.isDeleted())
                .isPinned(isPinned)
                .lastActivityAt(lastActivityAt)
                .unreadCount(countUnreadMessages(conversation.getConversationId(), currentUserId))
                .lastMessage(buildLastMessage(conversation.getConversationId()));
        
        if ("dm".equals(conversation.getType())) {
            ConversationResponseDto.UserProfileDto otherParticipant = findOtherParticipant(conversation, currentUserId);
            String displayName = otherParticipant.getDisplayName() != null ? 
                    otherParticipant.getDisplayName() : otherParticipant.getUsername();
            
            builder.name(displayName)
                   .otherParticipant(otherParticipant)
                   .memberCount(2);
        } else {
            builder.name(conversation.getName())
                   .memberCount(getMemberCount(conversation.getConversationId()));
        }

        return builder.build();
    }

    private ConversationResponseDto.LastMessageDto buildLastMessage(UUID conversationId) {
        List<Message> messages = messageRepository.findByConversationIdWithLimit(conversationId, 1);
        if (messages.isEmpty()) {
            return null;
        }

        Message latestMessage = messages.get(0);
        com.chatapp.chat_service.auth.dto.UserDTO sender = userService.getUserProfile(latestMessage.getSenderId());
        String senderName = sender.getDisplayName() != null && !sender.getDisplayName().isBlank()
                ? sender.getDisplayName()
                : sender.getUserName();

        return ConversationResponseDto.LastMessageDto.builder()
                .messageId(latestMessage.getKey().getMessageId())
                .senderId(latestMessage.getSenderId())
                .senderName(senderName)
                .content(latestMessage.isDeleted() ? "Tin nhắn đã bị xóa" : latestMessage.getContent())
                .messageType(latestMessage.getType())
                .createdAt(latestMessage.getCreatedAt())
                .build();
    }
    
    private ConversationResponseDto.UserProfileDto findOtherParticipant(Conversation conversation, UUID currentUserId) {
        List<ConversationMembers> members = memberRepository.findAllByKeyConversationId(conversation.getConversationId());
        
        UUID otherUserId = members.stream()
                .map(member -> member.getKey().getUserId())
                .filter(id -> !id.equals(currentUserId))
                .findFirst()
                .orElse(null);
        
        if (otherUserId != null) {
            // Map generic UserDTO to conversation-specific UserProfileDto
            com.chatapp.chat_service.auth.dto.UserDTO userDto = userService.getUserProfile(otherUserId);
            return ConversationResponseDto.UserProfileDto.builder()
                    .userId(userDto.getUserId())
                    .username(userDto.getUserName())
                    .displayName(userDto.getDisplayName())
                    .avatarUrl(userDto.getAvatarUrl())
                    .isOnline(userService.isUserOnline(otherUserId))
                    .build();
        }
        
        return ConversationResponseDto.UserProfileDto.builder()
                .userId(UUID.randomUUID())
                .username("Unknown User")
                .displayName("Unknown User")
                .isOnline(false)
                .build();
    }
    
    private Integer getMemberCount(UUID conversationId) {
        return (int) memberRepository.countByKeyConversationId(conversationId);
    }

    private int countUnreadMessages(UUID conversationId, UUID userId) {
        List<Message> messages = messageRepository.findAllByConversationId(conversationId);
        if (messages.isEmpty()) {
            return 0;
        }

        Set<UUID> readMessageIds = messageReadReceiptRepository.findByConversationIdAndReaderId(conversationId, userId)
                .stream()
                .map(MessageReadReceipt::getKey)
                .map(MessageReadReceipt.MessageReadReceiptKey::getMessageId)
                .collect(Collectors.toSet());

        return (int) messages.stream()
                .filter(message -> !message.isDeleted())
                .filter(message -> !userId.equals(message.getSenderId()))
                .filter(message -> !readMessageIds.contains(message.getKey().getMessageId()))
                .count();
    }
    
    public Conversation getOrCreateDMConversation(UUID userId1, UUID userId2) {
        Optional<Conversation> existingDM = findPrivateConversationWithCache(userId1, userId2);
        
        if (existingDM.isPresent()) {
            return existingDM.get();
        }
        
        ConversationRequest dmRequest = new ConversationRequest();
        dmRequest.setType("dm");
        dmRequest.setName("Direct Message");
        dmRequest.setDescription("Private conversation between two users");
        dmRequest.setMemberIds(List.of(userId2));
        
        return createConversation(dmRequest, userId1);
    }
    
    public Conversation updateConversation(UUID conversationId, String name, String description, 
                                          String backgroundUrl, UUID requesterId) {
        Conversation conversation = conversationRepository.findByConversationId(conversationId)
                .filter(c -> !c.isDeleted())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        ConversationMembers member = memberRepository.findById(
                new ConversationMembers.ConversationMemberKey(conversationId, requesterId)
        ).orElseThrow(() -> new ForbiddenException("You are not a member of this conversation"));
        
        String role = member.getRole();
        if (!"owner".equals(role) && !"admin".equals(role)) {
            throw new ForbiddenException("Only owner and admin can update conversation info");
        }
        
        if (name != null && !name.trim().isEmpty()) {
            conversation.setName(name);
        }
        if (description != null) {
            conversation.setDescription(description);
        }
        if (backgroundUrl != null) {
            conversation.setBackgroundUrl(backgroundUrl);
        }
        
        conversation.setUpdatedAt(Instant.now());
        conversationRepository.save(conversation);
        
        String cacheKey = "conversation:" + conversationId;
        redisTemplate.opsForValue().set(cacheKey, conversation, CACHE_TTL);
        
        if (conversationElasticsearchService != null) {
            try {
                conversationElasticsearchService.indexConversation(conversation);
            } catch (Exception e) {
                logger.warn("Failed to update conversation in Elasticsearch: {}", conversationId, e);
            }
        }
        
        logger.info("Updated conversation {} by user {}", conversationId, requesterId);
        return conversation;
    }

    public boolean pinConversation(UUID conversationId, UUID userId) {
        Optional<UserConversation> userConvOpt = userConversationRepository.findByUserIdAndConversationId(userId, conversationId);
        if (userConvOpt.isPresent()) {
            UserConversation userConv = userConvOpt.get();
            if (userConv.getKey().isPinned()) return true; 

            long pinnedCount = userConversationRepository.findByUserId(userId, org.springframework.data.domain.PageRequest.of(0, 100))
                    .getContent()
                    .stream()
                    .filter(uc -> uc.getKey().isPinned())
                    .count();
            if (pinnedCount >= MAX_PINNED_CONVERSATIONS) {
                throw new BusinessException("Chi duoc ghim toi da 5 hoi thoai");
            }
            
            userConversationRepository.delete(userConv);
            
            UserConversation updated = UserConversation.builder()
                    .key(UserConversation.UserConversationKey.builder()
                            .userId(userId)
                            .isPinned(true)
                            .lastActivityAt(userConv.getKey().getLastActivityAt())
                            .conversationId(conversationId)
                            .build())
                    .joinedAt(userConv.getJoinedAt())
                    .role(userConv.getRole())
                    .build();
            userConversationRepository.save(updated);
            return true;
        }
        return false;
    }

    public boolean unpinConversation(UUID conversationId, UUID userId) {
        Optional<UserConversation> userConvOpt = userConversationRepository.findByUserIdAndConversationId(userId, conversationId);
        if (userConvOpt.isPresent()) {
            UserConversation userConv = userConvOpt.get();
            if (!userConv.getKey().isPinned()) return true; 
            
            userConversationRepository.delete(userConv);
            
            UserConversation updated = UserConversation.builder()
                    .key(UserConversation.UserConversationKey.builder()
                            .userId(userId)
                            .isPinned(false)
                            .lastActivityAt(userConv.getKey().getLastActivityAt())
                            .conversationId(conversationId)
                            .build())
                    .joinedAt(userConv.getJoinedAt())
                    .role(userConv.getRole())
                    .build();
            userConversationRepository.save(updated);
            return true;
        }
        return false;
    }
}
