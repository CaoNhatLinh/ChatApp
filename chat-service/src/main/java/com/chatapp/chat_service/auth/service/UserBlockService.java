package com.chatapp.chat_service.auth.service;

import com.chatapp.chat_service.auth.dto.UserDTO;
import com.chatapp.chat_service.auth.entity.UserBlock;
import com.chatapp.chat_service.auth.repository.UserBlockRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.friendship.entity.Friendship;
import com.chatapp.chat_service.friendship.repository.FriendshipRepository;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserBlockService {

    private final UserBlockRepository userBlockRepository;
    private final FriendshipRepository friendshipRepository;
    private final UserService userService;
    private final KafkaEventProducer kafkaEventProducer;

    /**
     * Block a user
     */
    @Transactional
    public void blockUser(UUID blockerId, UUID blockedUserId, String reason) {
        // Cannot block yourself
        if (blockerId.equals(blockedUserId)) {
            throw new BadRequestException("Cannot block yourself");
        }

        // Check if already blocked
        UserBlock existingBlock = userBlockRepository.findByBlockerIdAndBlockedUserId(blockerId, blockedUserId);
        if (existingBlock != null) {
            throw new BadRequestException("User is already blocked");
        }

        // Create block
        UserBlock.UserBlockKey key = new UserBlock.UserBlockKey(blockerId, blockedUserId);

        UserBlock userBlock = UserBlock.builder()
                .key(key)
                .blockedAt(Instant.now())
                .reason(reason)
                .build();

        userBlockRepository.save(userBlock);

        // Remove friendship if exists
        Friendship friendship = friendshipRepository.findByUserIdAndFriendId(blockerId, blockedUserId);
        if (friendship != null) {
            friendshipRepository.delete(friendship);
            log.info("Removed friendship between {} and {} due to block", blockerId, blockedUserId);
        }

        // Publish event
        kafkaEventProducer.publishUserBlockEvent(blockerId, blockedUserId, "BLOCK");

        log.info("User {} blocked user {} with reason: {}", blockerId, blockedUserId, reason);
    }

    /**
     * Unblock a user
     */
    @Transactional
    public void unblockUser(UUID blockerId, UUID blockedUserId) {
        // Check if block exists
        UserBlock existingBlock = userBlockRepository.findByBlockerIdAndBlockedUserId(blockerId, blockedUserId);
        if (existingBlock == null) {
            throw new BadRequestException("User is not blocked");
        }

        // Delete block
        userBlockRepository.deleteByBlockerIdAndBlockedUserId(blockerId, blockedUserId);

        // Publish event
        kafkaEventProducer.publishUserBlockEvent(blockerId, blockedUserId, "UNBLOCK");

        log.info("User {} unblocked user {}", blockerId, blockedUserId);
    }

    /**
     * Get all blocked users for a user
     */
    public List<UserDTO> getBlockedUsers(UUID blockerId) {
        List<UserBlock> blocks = userBlockRepository.findByBlockerId(blockerId);

        return blocks.stream()
                .map(block -> userService.getUserProfile(block.getKey().getBlockedUserId()))
                .collect(Collectors.toList());
    }

    /**
     * Check if a user is blocked
     */
    public boolean isBlocked(UUID blockerId, UUID blockedUserId) {
        UserBlock block = userBlockRepository.findByBlockerIdAndBlockedUserId(blockerId, blockedUserId);
        return block != null;
    }

    /**
     * Check if two users have blocked each other
     */
    public boolean areMutuallyBlocked(UUID userId1, UUID userId2) {
        boolean user1BlocksUser2 = isBlocked(userId1, userId2);
        boolean user2BlocksUser1 = isBlocked(userId2, userId1);
        return user1BlocksUser2 || user2BlocksUser1;
    }
}
