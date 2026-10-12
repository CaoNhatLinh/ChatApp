package com.chatapp.chat_service.canonical.poll;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.messaging.MessageSender;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class PollService {
    private final PollRepository polls;
    private final ConversationAuthorizationService authorization;
    private final CanonicalEventRecorder events;
    private final RealtimePublisher realtime;
    private final MessageSender messages;

    public PollService(
            PollRepository polls,
            ConversationAuthorizationService authorization,
            CanonicalEventRecorder events,
            RealtimePublisher realtime,
            MessageSender messages) {
        this.polls = polls;
        this.authorization = authorization;
        this.events = events;
        this.realtime = realtime;
        this.messages = messages;
    }

    public CanonicalApiContracts.PollView create(UUID actorId, CanonicalApiContracts.PollCreateRequest request) {
        authorization.requirePermission(request.conversationId(), actorId, ConversationPermission.POLL_CREATE);
        validateCreate(request);
        UUID pollId = UUID.nameUUIDFromBytes(
                (actorId + "|poll|" + request.clientMessageId()).getBytes(StandardCharsets.UTF_8));
        CanonicalMessage pollMessage = messages.sendMessage(actorId, request.conversationId(),
                new CanonicalApiContracts.MessageSendRequest(
                        request.clientMessageId(), "POLL", request.question().trim(), "PLAIN",
                        null, null, null, pollId, null, null, null, List.of(), Set.of(), false));
        CanonicalPoll existing = polls.findById(pollId);
        if (existing != null) {
            if (!matches(existing, request)) {
                throw new ConflictException("clientMessageId is already bound to another poll payload");
            }
            polls.create(existing);
            CanonicalApiContracts.PollView recovered = view(actorId, existing);
            publish(recovered);
            return recovered;
        }
        CanonicalPoll poll = new CqlCanonicalRecords.CanonicalPoll(
                pollId, request.conversationId(), pollMessage.messageBucket(), pollMessage.messageId(),
                request.question().trim(), request.options().stream().map(String::trim).toList(),
                Boolean.TRUE.equals(request.isMultipleChoice()), Boolean.TRUE.equals(request.isAnonymous()),
                false, actorId, Instant.now(), request.closesAt(), null, null);
        polls.create(poll);
        audit(actorId, poll.conversationId(), "POLL_CREATE", pollId);
        CanonicalApiContracts.PollView view = view(actorId, poll);
        publish(view);
        return view;
    }

    public CanonicalApiContracts.PollView get(UUID actorId, UUID pollId) {
        CanonicalApiContracts.PollView view = view(actorId, requirePoll(actorId, pollId));
        publish(view);
        return view;
    }

    public CanonicalApiContracts.PollView vote(
            UUID actorId, UUID pollId, CanonicalApiContracts.PollVoteRequest request) {
        CanonicalPoll poll = requireOpenPoll(actorId, pollId);
        Set<Integer> selected = request.selectedOptionIndexes();
        if (selected == null || selected.isEmpty()) {
            throw new BadRequestException("at least one poll option is required");
        }
        if (!Boolean.TRUE.equals(poll.isMultipleChoice()) && selected.size() != 1) {
            throw new BadRequestException("this poll allows exactly one option");
        }
        if (selected.stream().anyMatch(index -> index == null || index < 0 || index >= poll.options().size())) {
            throw new BadRequestException("poll option index is out of range");
        }
        PollRepository.VoteResult result = polls.vote(pollId, actorId, selected);
        rejectConflict(result);
        if (result == PollRepository.VoteResult.CREATED || result == PollRepository.VoteResult.UPDATED) {
            audit(actorId, poll.conversationId(),
                    result == PollRepository.VoteResult.CREATED ? "POLL_VOTE" : "POLL_VOTE_CHANGE", pollId);
        }
        CanonicalApiContracts.PollView view = view(actorId, poll);
        publish(view);
        return view;
    }

    public CanonicalApiContracts.PollView removeVote(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requireOpenPoll(actorId, pollId);
        PollRepository.VoteResult result = polls.removeVote(pollId, actorId);
        rejectConflict(result);
        if (result == PollRepository.VoteResult.REMOVED) {
            audit(actorId, poll.conversationId(), "POLL_VOTE_REMOVE", pollId);
        }
        CanonicalApiContracts.PollView view = view(actorId, poll);
        publish(view);
        return view;
    }

    public CanonicalApiContracts.PollView close(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        if (!actorId.equals(poll.createdBy())
                && !authorization.effectivePermissions(poll.conversationId(), actorId)
                .contains(ConversationPermission.POLL_MANAGE)) {
            throw new ForbiddenException("only the poll creator or a poll manager can close this poll");
        }
        if (!Boolean.TRUE.equals(poll.isClosed()) && polls.close(poll, actorId, Instant.now())) {
            audit(actorId, poll.conversationId(), "POLL_CLOSE", pollId);
        }
        CanonicalApiContracts.PollView view = view(actorId, requirePoll(actorId, pollId));
        publish(view);
        return view;
    }

    private void validateCreate(CanonicalApiContracts.PollCreateRequest request) {
        if (request.clientMessageId() == null) {
            throw new BadRequestException("clientMessageId is required");
        }
        if (!StringUtils.hasText(request.question()) || request.question().trim().length() > 500) {
            throw new BadRequestException("poll question is required and must not exceed 500 characters");
        }
        if (request.options() == null || request.options().size() < 2 || request.options().size() > 10
                || request.options().stream().anyMatch(option -> !StringUtils.hasText(option) || option.trim().length() > 200)) {
            throw new BadRequestException("poll must have 2 to 10 non-empty options of at most 200 characters");
        }
        if (request.options().stream().map(option -> option.trim().toLowerCase(Locale.ROOT)).distinct().count()
                != request.options().size()) {
            throw new BadRequestException("poll options must be unique");
        }
        if (request.closesAt() != null && !request.closesAt().isAfter(Instant.now())) {
            throw new BadRequestException("poll closesAt must be in the future");
        }
    }

    private boolean matches(CanonicalPoll poll, CanonicalApiContracts.PollCreateRequest request) {
        return poll.conversationId().equals(request.conversationId())
                && poll.question().equals(request.question().trim())
                && poll.options().equals(request.options().stream().map(String::trim).toList())
                && poll.isMultipleChoice().equals(Boolean.TRUE.equals(request.isMultipleChoice()))
                && poll.isAnonymous().equals(Boolean.TRUE.equals(request.isAnonymous()))
                && Objects.equals(poll.closesAt(), request.closesAt());
    }

    private CanonicalPoll requirePoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = polls.findById(pollId);
        if (poll == null) {
            throw new NotFoundException("poll not found");
        }
        authorization.requireMember(poll.conversationId(), actorId);
        return poll;
    }

    private CanonicalPoll requireOpenPoll(UUID actorId, UUID pollId) {
        CanonicalPoll poll = requirePoll(actorId, pollId);
        if (Boolean.TRUE.equals(poll.isClosed())
                || poll.closesAt() != null && !poll.closesAt().isAfter(Instant.now())) {
            throw new ConflictException("poll is closed");
        }
        return poll;
    }

    private CanonicalApiContracts.PollView view(UUID actorId, CanonicalPoll poll) {
        PollRepository.PollState state = polls.findStates(List.of(poll.pollId()), actorId).get(poll.pollId());
        if (state == null) {
            throw new IllegalStateException("poll state is missing");
        }
        return new CanonicalApiContracts.PollView(
                poll, state.optionCounts(), state.currentUserOptionIndexes(), state.totalVoters());
    }

    private void rejectConflict(PollRepository.VoteResult result) {
        if (result == PollRepository.VoteResult.CLOSED) {
            throw new ConflictException("poll is closed");
        }
        if (result == PollRepository.VoteResult.CONFLICT) {
            throw new ConflictException("vote changed concurrently; reload the poll and retry");
        }
    }

    private void audit(UUID actorId, UUID conversationId, String action, UUID pollId) {
        events.record(actorId, conversationId, action, "poll", pollId.toString(),
                action.startsWith("POLL_VOTE") ? actorId : null, null, Map.of(), Map.of());
    }

    private void publish(CanonicalApiContracts.PollView view) {
        realtime.publishToConversation(view.poll().conversationId(), "/polls",
                new CanonicalApiContracts.PollAggregateView(
                        view.poll(), view.optionCounts(), view.totalVoters()));
    }
}
