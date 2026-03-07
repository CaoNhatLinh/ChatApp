package com.chatapp.chat_service.poll.controller;

import com.chatapp.chat_service.poll.dto.PollCreationRequest;
import com.chatapp.chat_service.poll.dto.PollDto;
import com.chatapp.chat_service.poll.entity.Poll;
import com.chatapp.chat_service.poll.service.MessagePollService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.chatapp.chat_service.security.core.AppUserPrincipal;
import com.chatapp.chat_service.kafka.KafkaEventProducer;
import com.chatapp.chat_service.message.dto.MessageRequest;
import com.chatapp.chat_service.message.dto.MessageResponseDto;
import com.chatapp.chat_service.message.service.MessageService;
import com.chatapp.chat_service.conversation.entity.ConversationMembers;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import java.util.Map;

@RestController
@RequestMapping("/api/polls")
@RequiredArgsConstructor
public class PollController {

    private final MessagePollService pollService;
    private final KafkaEventProducer kafkaEventProducer;
    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationMemberRepository conversationMemberRepository;

    /**
     * Tạo poll mới
     */
    @PostMapping
    public ResponseEntity<Poll> createPoll(
            @RequestBody PollCreationRequest request,
            Authentication authentication
    ) {
        UUID createdBy = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        UUID conversationId = request.getConversationId();
        UUID messageId = request.getMessageId();
        
        UUID resolvedMessageId = messageId != null ? messageId : Uuids.timeBased();
        Poll poll = pollService.createPoll(
                conversationId, 
                resolvedMessageId, 
                request.getQuestion(), 
                request.getOptions(), 
                createdBy, 
                request.isMultipleChoice(), 
                request.isAnonymous(),
                request.getExpiresAt()
        );
        
        if (messageId == null) {
            MessageRequest messageRequest = MessageRequest.builder()
                    .messageId(resolvedMessageId)
                    .conversationId(conversationId)
                    .senderId(createdBy)
                    .content(poll.getPollId().toString())
                    .type("POLL")
                    .build();
            
            MessageResponseDto savedMessage = messageService.sendMessage(messageRequest);
            
            messagingTemplate.convertAndSend(
                    "/topic/conversation/" + conversationId,
                    savedMessage
            );
            
            try {
                var members = conversationMemberRepository.findAllByKeyConversationId(conversationId);
                for (ConversationMembers member : members) {
                    messagingTemplate.convertAndSend(
                            "/topic/user/" + member.getKey().getUserId() + "/new-message",
                            Map.of(
                                    "conversationId", conversationId.toString(),
                                    "senderId", createdBy.toString()
                            )
                    );
                }
            } catch (Exception memberEx) {
            }
        }

        return ResponseEntity.ok(poll);
    }

    /**
     * Vote trong poll
     */
    @PostMapping("/{pollId}/vote")
    public ResponseEntity<PollDto> vote(
            @PathVariable UUID pollId,
            @RequestParam List<String> selectedOptions,
            Authentication authentication
    ) {
        UUID userId = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        pollService.vote(pollId, userId, selectedOptions);
        
        PollDto userResults = pollService.getPollResults(pollId, userId);
        
        pollService.broadcastPollUpdate(pollId);
        
        return ResponseEntity.ok(userResults);
    }

    /**
     * Lấy kết quả poll
     */
    @GetMapping("/{pollId}/results")
    public ResponseEntity<PollDto> getPollResults(
            @PathVariable UUID pollId,
            Authentication authentication
    ) {
        UUID currentUserId = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        PollDto results = pollService.getPollResults(pollId, currentUserId);
        return ResponseEntity.ok(results);
    }

    /**
     * Đóng poll
     */
    @PostMapping("/{pollId}/close")
    public ResponseEntity<Void> closePoll(
            @PathVariable UUID pollId,
            Authentication authentication
    ) {
        UUID userId = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        pollService.closePoll(pollId, userId);
        
        return ResponseEntity.ok().build();
    }

    /**
     * Xóa vote
     */
    @DeleteMapping("/{pollId}/vote")
    public ResponseEntity<PollDto> removeVote(
            @PathVariable UUID pollId,
            Authentication authentication
    ) {
        UUID userId = ((AppUserPrincipal) authentication.getPrincipal()).getUserId();
        pollService.removeVote(pollId, userId);
        PollDto userResults = pollService.getPollResults(pollId, userId);
        
        pollService.broadcastPollUpdate(pollId);
        
        return ResponseEntity.ok(userResults);
    }
}
