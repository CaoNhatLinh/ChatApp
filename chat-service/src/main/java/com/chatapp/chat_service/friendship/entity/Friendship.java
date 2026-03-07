package com.chatapp.chat_service.friendship.entity;

import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.*;

import java.time.Instant;
import java.util.UUID;

@Table("friendships")
public class Friendship {
    public enum Status {
        PENDING, ACCEPTED, REJECTED, BLOCKED
    }

    @PrimaryKey
    private FriendshipKey key;
    private Status status;

    @Column("created_at")
    private Instant createdAt;
    @Column("updated_at")
    private Instant updatedAt;

    @PrimaryKeyClass
    public static class FriendshipKey {
        @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.PARTITIONED)
        private UUID userId;

        @PrimaryKeyColumn(name = "friend_id", type = PrimaryKeyType.CLUSTERED)
        private UUID friendId;

        public FriendshipKey() {}

        public FriendshipKey(UUID userId, UUID friendId) {
            this.userId = userId;
            this.friendId = friendId;
        }

        public UUID getUserId() { return userId; }
        public void setUserId(UUID userId) { this.userId = userId; }
        public UUID getFriendId() { return friendId; }
        public void setFriendId(UUID friendId) { this.friendId = friendId; }
    }

    public Friendship() {}

    public Friendship(FriendshipKey key, Status status) {
        this.key = key;
        this.status = status;
        this.createdAt = Instant.now();
    }

    public FriendshipKey getKey() { return key; }
    public void setKey(FriendshipKey key) { this.key = key; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    
    public UUID getUserId() {
        return key != null ? key.getUserId() : null;
    }
    
    public UUID getFriendId() {
        return key != null ? key.getFriendId() : null;
    }
}