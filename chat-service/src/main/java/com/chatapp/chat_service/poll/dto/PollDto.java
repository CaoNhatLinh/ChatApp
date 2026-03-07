package com.chatapp.chat_service.poll.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PollDto {
    private UUID pollId;
    private UUID conversationId;
    private UUID messageId;
    private String question;
    private List<PollOptionDto> options;
    @JsonProperty("isClosed")
    private boolean isClosed;
    
    @JsonProperty("isMultipleChoice")
    private boolean isMultipleChoice;
    
    @JsonProperty("isAnonymous")
    private boolean isAnonymous;

    private UUID createdBy;
    private String createdByUsername;
    private Instant createdAt;
    private Instant expiresAt;
    @JsonProperty("totalVotes")
    private long totalVotes;
    
    @JsonProperty("currentUserVotes")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private List<String> currentUserVotes;
    
    @JsonProperty("targetUserId")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private UUID targetUserId;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PollOptionDto {
        private String option;
        private long voteCount;
        private double percentage;
        private List<UUID> voterIds;
        private List<String> voterNames;
    }
}
