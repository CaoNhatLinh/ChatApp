package com.chatapp.chat_service.poll.service;

import com.chatapp.chat_service.poll.dto.PollDto;
import com.chatapp.chat_service.poll.entity.Poll;
import com.chatapp.chat_service.poll.entity.PollVote;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.chatapp.chat_service.poll.repository.PollRepository;
import com.chatapp.chat_service.auth.repository.UserRepository;
import com.chatapp.chat_service.poll.repository.PollVoteRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MessagePollService {

    private final PollRepository pollRepository;
    private final PollVoteRepository pollVoteRepository;
    private final UserRepository userRepository;
    private final RedisTemplate<String, Object> redisTemplate;
    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Tạo poll mới
     */
    public Poll createPoll(UUID conversationId, UUID messageId, String question, List<String> options,
                          UUID createdBy, boolean isMultipleChoice, boolean isAnonymous, Instant expiresAt) {
        Poll poll = Poll.builder()
                .pollId(UUID.randomUUID())
                .conversationId(conversationId)
                .messageId(messageId)
                .question(question)
                .options(options)
                .createdBy(createdBy)
                .createdAt(Instant.now())
                .isClosed(false)
                .isMultipleChoice(isMultipleChoice)
                .isAnonymous(isAnonymous)
                .expiresAt(expiresAt)
                .build();

        pollRepository.save(poll);
        
        String cacheKey = "poll:" + poll.getPollId();
        redisTemplate.opsForValue().set(cacheKey, poll, Duration.ofHours(24));

        log.info("Created poll {} in conversation {}", poll.getPollId(), conversationId);
        return poll;
    }

    /**
     * Vote trong poll
     */
    public void vote(UUID pollId, UUID userId, List<String> selectedOptions) {
        Poll poll = findPollById(pollId);
        
        if (poll.getIsClosed()) {
            throw new IllegalStateException("Poll is closed");
        }

        if (poll.getExpiresAt() != null && Instant.now().isAfter(poll.getExpiresAt())) {
            throw new IllegalStateException("Poll has expired");
        }

        if (poll.getIsMultipleChoice() != null && !poll.getIsMultipleChoice() && selectedOptions.size() > 1) {
            throw new IllegalArgumentException("Multiple selection not allowed");
        }

        for (String option : selectedOptions) {
            if (!poll.getOptions().contains(option)) {
                throw new IllegalArgumentException("Invalid option: " + option);
            }
        }

        PollVote.PollVoteKey voteKey = PollVote.PollVoteKey.builder()
                .pollId(pollId)
                .userId(userId)
                .build();
        
        pollVoteRepository.deleteByPollIdAndUserId(pollId, userId);

        PollVote vote = PollVote.builder()
                .key(voteKey)
                .selectedOptions(selectedOptions)
                .votedAt(Instant.now())
                .build(); 
        pollVoteRepository.save(vote); 

        clearPollResultsCache(pollId);

        log.info("User {} voted in poll {} with options {}", userId, pollId, selectedOptions);
    }

    /**
     * Broadcast aggregate poll update to all conversation members via WebSocket.
     * Should be called AFTER the HTTP response is computed to avoid race conditions.
     */
    public void broadcastPollUpdate(UUID pollId) {
        PollDto aggregate = getAggregatePollDto(pollId);
        log.info("BROADCASTING POLL UPDATE (POLL_ID: {}): aggregate-only, no user-specific data", pollId);
        messagingTemplate.convertAndSend("/topic/conversation/" + aggregate.getConversationId() + "/polls", aggregate);
    }

    /**
     * Lấy kết quả poll - Ưu tiên Redis, sau đó tới Cassandra
     */
    /**
     * Lấy kết quả poll - Chỉ dành cho Aggregate (Công khai)
     */
    public PollDto getAggregatePollDto(UUID pollId) {
        String cacheKey = "poll:agg:" + pollId;
        
        PollDto cached = (PollDto) redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            log.debug("Cache hit for aggregate poll results: {}", pollId);
            return clonePollDto(cached);
        }

        Poll poll = findPollById(pollId);
        List<PollVote> votes = pollVoteRepository.findByPollId(pollId);
        long totalVotes = votes.stream()
                .map(v -> v.getKey().getUserId())
                .distinct()
                .count();

        List<PollDto.PollOptionDto> optionResults = poll.getOptions().stream()
                .map(option -> {
                    List<UUID> voterIds = votes.stream()
                            .filter(vote -> vote.getSelectedOptions().contains(option))
                            .map(vote -> vote.getKey().getUserId())
                            .distinct() 
                            .collect(Collectors.toList());
                    
                    List<String> voterNames = new ArrayList<>();
                    if (Boolean.FALSE.equals(poll.getIsAnonymous()) && !voterIds.isEmpty()) {
                        List<UUID> topVoterIds = voterIds.stream().limit(10).collect(Collectors.toList());
                        voterNames = userRepository.findByUserIdIn(topVoterIds).stream()
                            .map(user -> user.getDisplayName() != null ? user.getDisplayName() : user.getUsername())
                            .collect(Collectors.toList());
                        
                        if (voterIds.size() > 10) {
                            voterNames.add("và " + (voterIds.size() - 10) + " người khác...");
                        }
                    }
                    
                    long voteCount = voterIds.size();
                    double percentage = totalVotes > 0 ? (double) voteCount / totalVotes * 100 : 0;

                    return PollDto.PollOptionDto.builder()
                            .option(option)
                            .voteCount(voteCount)
                            .percentage(percentage)
                            .voterIds(Boolean.TRUE.equals(poll.getIsAnonymous()) ? Collections.emptyList() : voterIds.stream().limit(50).collect(Collectors.toList()))
                            .voterNames(voterNames)
                            .build();
                })
                .collect(Collectors.toList());

        PollDto results = PollDto.builder()
                .pollId(poll.getPollId())
                .conversationId(poll.getConversationId())
                .messageId(poll.getMessageId())
                .question(poll.getQuestion())
                .options(optionResults)
                .isClosed(poll.getIsClosed())
                .isMultipleChoice(poll.getIsMultipleChoice() != null ? poll.getIsMultipleChoice() : false)
                .isAnonymous(poll.getIsAnonymous() != null ? poll.getIsAnonymous() : false)
                .createdBy(poll.getCreatedBy())
                .createdAt(poll.getCreatedAt())
                .expiresAt(poll.getExpiresAt())
                .totalVotes(totalVotes)
                .currentUserVotes(null) 
                .targetUserId(null) 
                .build();

        redisTemplate.opsForValue().set(cacheKey, results, Duration.ofMinutes(10));
        log.debug("Cached aggregate poll results for poll: {}", pollId);
        return results;
    }

    /**
     * Lấy kết quả poll đầy đủ (kèm phiếu bầu của User hiện tại)
     */
    public PollDto getPollResults(UUID pollId, UUID currentUserId) {
        PollDto aggregate = getAggregatePollDto(pollId);

        if (currentUserId == null) {
            return clonePollDto(aggregate);
        }

        PollVote vote = pollVoteRepository.findByPollIdAndUserId(pollId, currentUserId);
        List<String> currentUserVotes = (vote != null) ? vote.getSelectedOptions() : Collections.emptyList();

        log.debug("Found {} votes for user {} in poll {}", currentUserVotes.size(), currentUserId, pollId);

        PollDto result = PollDto.builder()
                .pollId(aggregate.getPollId())
                .conversationId(aggregate.getConversationId())
                .messageId(aggregate.getMessageId())
                .question(aggregate.getQuestion())
                .options(new ArrayList<>(aggregate.getOptions())) 
                .isClosed(aggregate.isClosed())
                .isMultipleChoice(aggregate.isMultipleChoice())
                .isAnonymous(aggregate.isAnonymous())
                .createdBy(aggregate.getCreatedBy())
                .createdAt(aggregate.getCreatedAt())
                .expiresAt(aggregate.getExpiresAt())
                .totalVotes(aggregate.getTotalVotes())
                .currentUserVotes(currentUserVotes)
                .targetUserId(currentUserId)
                .build();
        return result;    }

    /**
     * Tìm kiếm Poll linh hoạt: Redis -> Cassandra
     */
    private Poll findPollById(UUID pollId) {
        String pollCacheKey = "poll:" + pollId;
        Poll poll = (Poll) redisTemplate.opsForValue().get(pollCacheKey);
        
        if (poll == null) {
            log.debug("Poll {} cache miss, fetching from DB", pollId);
            poll = pollRepository.findById(pollId).orElseThrow(() -> 
                new IllegalArgumentException("Poll not found: " + pollId));
            
            redisTemplate.opsForValue().set(pollCacheKey, poll, Duration.ofHours(24));
        }
        return poll;
    }

    /**
     * Đóng poll
     */
    public void closePoll(UUID pollId, UUID userId) {
        Poll poll = findPollById(pollId);
        
        if (!poll.getCreatedBy().equals(userId)) {
            throw new IllegalStateException("Only poll creator can close the poll");
        }

        poll.setIsClosed(true);
        
        pollRepository.save(poll);
        
        String pollCacheKey = "poll:" + pollId;
        redisTemplate.opsForValue().set(pollCacheKey, poll, Duration.ofHours(24));
        
        clearPollResultsCache(pollId);

        PollDto aggregate = getAggregatePollDto(pollId);
        messagingTemplate.convertAndSend("/topic/conversation/" + aggregate.getConversationId() + "/polls", aggregate);

        log.info("Poll {} closed by user {}", pollId, userId);
    }

    /**
     * Xóa vote của user
     */
    public void removeVote(UUID pollId, UUID userId) {
        pollVoteRepository.deleteByPollIdAndUserId(pollId, userId);
        
        clearPollResultsCache(pollId);

        log.info("Removed vote for user {} in poll {}", userId, pollId);
    }

    private void clearPollResultsCache(UUID pollId) {
        log.info("Clearing all cache keys for poll: {}", pollId);
        redisTemplate.delete("poll:agg:" + pollId);
        String userPattern = "poll:user:" + pollId + ":*";
        java.util.Set<String> keys = new java.util.HashSet<>();
        try {
            redisTemplate.execute((RedisCallback<Void>) connection -> {
                Cursor<byte[]> cursor = connection.scan(
                        ScanOptions.scanOptions().match(userPattern).count(100).build()
                );
                while (cursor.hasNext()) {
                    keys.add(new String(cursor.next()));
                }
                return null;
            });
        } catch (Exception e) {
            log.error("Error scanning poll cache keys: {}", e.getMessage(), e);
        }
        if (!keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    /**
     * Create a deep copy of a PollDto to avoid classloader mismatch issues
     * when objects are stored in Redis and Devtools restarts are used.
     */
    private PollDto clonePollDto(PollDto src) {
        if (src == null) return null;
        return PollDto.builder()
                .pollId(src.getPollId())
                .conversationId(src.getConversationId())
                .messageId(src.getMessageId())
                .question(src.getQuestion())
                .options(src.getOptions() != null ? new ArrayList<>(src.getOptions()) : Collections.emptyList())
                .isClosed(src.isClosed())
                .isMultipleChoice(src.isMultipleChoice())
                .isAnonymous(src.isAnonymous())
                .createdBy(src.getCreatedBy())
                .createdByUsername(src.getCreatedByUsername())
                .createdAt(src.getCreatedAt())
                .expiresAt(src.getExpiresAt())
                .totalVotes(src.getTotalVotes())
                .currentUserVotes(src.getCurrentUserVotes() != null ? new ArrayList<>(src.getCurrentUserVotes()) : Collections.emptyList())
                .targetUserId(src.getTargetUserId())
                .build();
    }
}
