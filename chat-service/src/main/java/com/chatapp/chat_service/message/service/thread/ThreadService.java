package com.chatapp.chat_service.message.service.thread;

import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.entity.Message;
import com.chatapp.chat_service.message.repository.MessageRepository;
import com.chatapp.chat_service.message.service.MessageEnrichmentService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ThreadService {

    private final MessageRepository messageRepository;
    private final MessageEnrichmentService enrichmentService;

    /**
     * Get all replies to a message (thread)
     */
    public List<MessageResponseDto> getThread(UUID conversationId, UUID parentMessageId, UUID currentUserId) {
        // Find all messages that reply to the parent message
        List<Message> replies = messageRepository.findByConversationIdAndReplyTo(conversationId, parentMessageId);

        if (replies.isEmpty()) {
            return new ArrayList<>();
        }

        // Enrich the replies with reactions, attachments, etc.
        return enrichmentService.enrichMessages(conversationId, replies, currentUserId);
    }

    /**
     * Get thread with pagination
     */
    public List<MessageResponseDto> getThreadPaginated(UUID conversationId, UUID parentMessageId, 
                                                      int page, int size, UUID currentUserId) {
        Pageable pageable = PageRequest.of(page, size);
        List<Message> replies = messageRepository.findByConversationIdAndReplyToPaginated(
                conversationId, parentMessageId, pageable);

        if (replies.isEmpty()) {
            return new ArrayList<>();
        }

        return enrichmentService.enrichMessages(conversationId, replies, currentUserId);
    }

    /**
     * Get thread count
     */
    public long getThreadCount(UUID conversationId, UUID parentMessageId) {
        return messageRepository.countByConversationIdAndReplyTo(conversationId, parentMessageId);
    }

    /**
     * Get thread summary (parent message + first few replies)
     */
    public Map<String, Object> getThreadSummary(UUID conversationId, UUID parentMessageId, 
                                               int replyLimit, UUID currentUserId) {
        // Get parent message
        Message parentMessage = messageRepository.findByConversationIdAndMessageId(
                conversationId, parentMessageId).orElse(null);

        if (parentMessage == null) {
            return null;
        }

        // Get replies
        List<Message> replies = messageRepository.findByConversationIdAndReplyToPaginated(
                conversationId, parentMessageId, PageRequest.of(0, replyLimit));

        // Enrich parent message
        List<MessageResponseDto> enrichedParent = enrichmentService.enrichMessages(
                conversationId, List.of(parentMessage), currentUserId);

        // Enrich replies
        List<MessageResponseDto> enrichedReplies = enrichmentService.enrichMessages(
                conversationId, replies, currentUserId);

        long totalReplies = getThreadCount(conversationId, parentMessageId);

        return Map.of(
                "parentMessage", enrichedParent.isEmpty() ? null : enrichedParent.get(0),
                "replies", enrichedReplies,
                "totalReplies", totalReplies,
                "hasMoreReplies", totalReplies > replyLimit
        );
    }

    /**
     * Get all threads in a conversation (all messages that have replies)
     */
    public List<Map<String, Object>> getAllThreads(UUID conversationId, UUID currentUserId) {
        // Find all messages that are replies
        List<Message> allReplies = messageRepository.findByConversationId(conversationId);

        // Group by replyTo to find thread roots
        Map<UUID, List<Message>> threads = allReplies.stream()
                .filter(m -> m.getReplyTo() != null)
                .collect(Collectors.groupingBy(Message::getReplyTo));

        List<Map<String, Object>> threadSummaries = new ArrayList<>();

        for (Map.Entry<UUID, List<Message>> entry : threads.entrySet()) {
            UUID parentMessageId = entry.getKey();
            List<Message> replies = entry.getValue();

            long replyCount = replies.size();
            Message latestReply = replies.stream()
                    .max((m1, m2) -> m1.getCreatedAt().compareTo(m2.getCreatedAt()))
                    .orElse(null);

            threadSummaries.add(Map.of(
                    "parentMessageId", parentMessageId,
                    "replyCount", replyCount,
                    "latestReplyAt", latestReply != null ? latestReply.getCreatedAt() : null
            ));
        }

        return threadSummaries;
    }

    /**
     * Delete a thread (parent message and all replies)
     */
    public void deleteThread(UUID conversationId, UUID parentMessageId, UUID userId) {
        // Find all replies
        List<Message> replies = messageRepository.findByConversationIdAndReplyTo(conversationId, parentMessageId);

        // Delete all replies
        for (Message reply : replies) {
            reply.setDeleted(true);
            messageRepository.save(reply);
        }

        // Delete parent message
        Message parentMessage = messageRepository.findByConversationIdAndMessageId(
                conversationId, parentMessageId).orElse(null);
        if (parentMessage != null) {
            parentMessage.setDeleted(true);
            messageRepository.save(parentMessage);
        }

        log.info("Thread deleted: parentMessageId={}, replyCount={}", parentMessageId, replies.size());
    }
}
