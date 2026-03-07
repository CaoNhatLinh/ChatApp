package com.chatapp.chat_service.poll.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("polls")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Poll {

    @PrimaryKey("poll_id")
    private UUID pollId;

    @Column("conversation_id")
    private UUID conversationId;

    @Column("message_id")
    private UUID messageId;

    @Column("created_by")
    private UUID createdBy;

    @Column("created_at")
    private Instant createdAt;

    @Column("question")
    private String question;

    @Column("options")
    private List<String> options;

    @Column("is_closed")
    private Boolean isClosed;

    @Column("is_multiple_choice")
    private Boolean isMultipleChoice;

    @Column("is_anonymous")
    private Boolean isAnonymous;

    @Column("expires_at")
    private Instant expiresAt;
}
