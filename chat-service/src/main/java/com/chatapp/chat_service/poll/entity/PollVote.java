package com.chatapp.chat_service.poll.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.cassandra.core.cql.PrimaryKeyType;
import org.springframework.data.cassandra.core.mapping.Column;
import org.springframework.data.cassandra.core.mapping.PrimaryKey;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyClass;
import org.springframework.data.cassandra.core.mapping.PrimaryKeyColumn;
import org.springframework.data.cassandra.core.mapping.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("poll_votes")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PollVote {

    @PrimaryKey
    private PollVoteKey key;

    @Column("selected_options")
    private List<String> selectedOptions; 

    @Column("voted_at")
    private Instant votedAt;

    @PrimaryKeyClass
    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class PollVoteKey {
        @PrimaryKeyColumn(name = "poll_id", type = PrimaryKeyType.PARTITIONED)
        private UUID pollId;

        @PrimaryKeyColumn(name = "user_id", type = PrimaryKeyType.CLUSTERED, ordinal = 0)
        private UUID userId;
    }
}
