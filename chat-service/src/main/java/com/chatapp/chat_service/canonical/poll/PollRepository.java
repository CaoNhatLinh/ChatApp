package com.chatapp.chat_service.canonical.poll;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public interface PollRepository {
    /** Idempotently creates metadata and repairs missing projections without resetting votes or closure. */
    void create(CanonicalPoll poll);

    CanonicalPoll findById(UUID pollId);

    List<CanonicalPoll> findByIds(List<UUID> pollIds);

    VoteResult vote(UUID pollId, UUID voterId, Set<Integer> selectedOptionIndexes);

    VoteResult removeVote(UUID pollId, UUID voterId);

    Map<UUID, PollState> findStates(List<UUID> pollIds, UUID voterId);

    boolean close(CanonicalPoll poll, UUID actorId, Instant closedAt);

    enum VoteResult { CREATED, UPDATED, REMOVED, IDEMPOTENT, CLOSED, CONFLICT }

    record PollState(
            Map<Integer, Long> optionCounts,
            Set<Integer> currentUserOptionIndexes,
            long totalVoters) {
    }
}
