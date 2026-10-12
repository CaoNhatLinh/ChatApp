package com.chatapp.chat_service.canonical.poll;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BatchStatementBuilder;
import com.datastax.oss.driver.api.core.cql.BatchType;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Repository
public class CassandraPollRepository implements PollRepository {
    private final CqlSession session;
    private final PreparedStatement savePoll;
    private final PreparedStatement savePollByConversation;
    private final PreparedStatement loadPollById;
    private final PreparedStatement loadPollsById;
    private final PreparedStatement initializePollState;
    private final PreparedStatement loadPollAggregate;
    private final PreparedStatement loadPollAggregates;
    private final PreparedStatement loadPollVote;
    private final PreparedStatement loadPollVotes;
    private final PreparedStatement createPollVote;
    private final PreparedStatement replacePollVote;
    private final PreparedStatement removePollVote;
    private final PreparedStatement replacePollAggregate;
    private final PreparedStatement closePollState;
    private final PreparedStatement closePoll;
    private final PreparedStatement closePollProjection;

    public CassandraPollRepository(CqlSession session) {
        this.session = session;
        this.savePoll = session.prepare("""
                INSERT INTO polls_by_id
                    (poll_id, conversation_id, message_bucket, message_id, question, options,
                     is_multiple_choice, is_anonymous, is_closed, created_by, created_at,
                     closes_at, closed_by, closed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS
                """);
        this.savePollByConversation = session.prepare("""
                INSERT INTO polls_by_conversation
                    (conversation_id, created_at, poll_id, message_bucket, message_id, is_closed)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        this.loadPollById = session.prepare("SELECT * FROM polls_by_id WHERE poll_id = ?");
        this.loadPollsById = session.prepare("SELECT * FROM polls_by_id WHERE poll_id IN ?");
        this.initializePollState = session.prepare("""
                INSERT INTO poll_state_by_poll
                    (poll_id, voter_id, selected_option_indexes, voted_at,
                     option_counts, total_voters, aggregate_version, is_closed)
                VALUES (?, ?, ?, ?, ?, 0, 0, ?) IF NOT EXISTS
                """);
        this.loadPollAggregate = session.prepare("""
                SELECT DISTINCT poll_id, option_counts, total_voters, aggregate_version, is_closed
                FROM poll_state_by_poll WHERE poll_id = ?
                """);
        this.loadPollAggregates = session.prepare("""
                SELECT DISTINCT poll_id, option_counts, total_voters, aggregate_version, is_closed
                FROM poll_state_by_poll WHERE poll_id IN ?
                """);
        this.loadPollVote = session.prepare(
                "SELECT selected_option_indexes FROM poll_state_by_poll WHERE poll_id = ? AND voter_id = ?");
        this.loadPollVotes = session.prepare("""
                SELECT poll_id, selected_option_indexes FROM poll_state_by_poll
                WHERE poll_id IN ? AND voter_id = ?
                """);
        this.createPollVote = session.prepare("""
                INSERT INTO poll_state_by_poll (poll_id, voter_id, selected_option_indexes, voted_at)
                VALUES (?, ?, ?, ?) IF NOT EXISTS
                """);
        this.replacePollVote = session.prepare("""
                UPDATE poll_state_by_poll SET selected_option_indexes = ?, voted_at = ?
                WHERE poll_id = ? AND voter_id = ? IF selected_option_indexes = ?
                """);
        this.removePollVote = session.prepare("""
                DELETE FROM poll_state_by_poll WHERE poll_id = ? AND voter_id = ?
                IF selected_option_indexes = ?
                """);
        this.replacePollAggregate = session.prepare("""
                UPDATE poll_state_by_poll
                SET option_counts = ?, total_voters = ?, aggregate_version = ?
                WHERE poll_id = ? IF aggregate_version = ? AND is_closed = false
                """);
        this.closePollState = session.prepare(
                "UPDATE poll_state_by_poll SET is_closed = true WHERE poll_id = ? IF is_closed = false");
        this.closePoll = session.prepare("""
                UPDATE polls_by_id SET is_closed = true, closed_by = ?, closed_at = ?
                WHERE poll_id = ? IF is_closed = false
                """);
        this.closePollProjection = session.prepare("""
                UPDATE polls_by_conversation SET is_closed = true
                WHERE conversation_id = ? AND created_at = ? AND poll_id = ?
                """);
    }

    @Override
    public void create(CanonicalPoll poll) {
        boolean created = session.execute(savePoll.bind(
                poll.pollId(), poll.conversationId(), poll.messageBucket(), poll.messageId(),
                poll.question(), poll.options(), poll.isMultipleChoice(), poll.isAnonymous(),
                poll.isClosed(), poll.createdBy(), poll.createdAt(), poll.closesAt(),
                poll.closedBy(), poll.closedAt())).wasApplied();
        if (!created) {
            CanonicalPoll existing = findById(poll.pollId());
            if (existing == null || !existing.conversationId().equals(poll.conversationId())
                    || !existing.messageId().equals(poll.messageId())
                    || !existing.question().equals(poll.question())
                    || !existing.options().equals(poll.options())
                    || !existing.isMultipleChoice().equals(poll.isMultipleChoice())
                    || !existing.isAnonymous().equals(poll.isAnonymous())
                    || !java.util.Objects.equals(existing.closesAt(), poll.closesAt())) {
                throw new ConflictException("poll identity is already bound to a different payload");
            }
            poll = existing;
        }
        // Each conditional write owns one partition. Retrying creation must never reset votes or closure.
        session.execute(initializePollState.bind(
                poll.pollId(), new UUID(0L, 0L), Set.of(), poll.createdAt(),
                emptyCounts(poll.options().size()), poll.isClosed()));
        session.execute(savePollByConversation.bind(
                poll.conversationId(), Uuids.startOf(poll.createdAt().toEpochMilli()), poll.pollId(),
                poll.messageBucket(), poll.messageId(), poll.isClosed()));
    }

    @Override
    public CanonicalPoll findById(UUID pollId) {
        Row row = session.execute(loadPollById.bind(pollId)).one();
        return row == null ? null : mapPoll(row);
    }

    @Override
    public List<CanonicalPoll> findByIds(List<UUID> pollIds) {
        if (pollIds.isEmpty()) return List.of();
        List<CanonicalPoll> polls = new ArrayList<>();
        for (Row row : session.execute(loadPollsById.bind(pollIds))) polls.add(mapPoll(row));
        return List.copyOf(polls);
    }

    @Override
    public VoteResult vote(UUID pollId, UUID voterId, Set<Integer> selected) {
        if (selected == null || selected.isEmpty()) return VoteResult.CONFLICT;
        for (int attempt = 0; attempt < 3; attempt++) {
            PollAggregate aggregate = loadAggregate(pollId);
            if (aggregate.closed()) return VoteResult.CLOSED;
            Row vote = session.execute(loadPollVote.bind(pollId, voterId)).one();
            Set<Integer> prior = vote == null ? Set.of()
                    : Set.copyOf(vote.getSet("selected_option_indexes", Integer.class));
            if (selected.equals(prior)) return VoteResult.IDEMPOTENT;
            Map<Integer, Long> counts = adjustCounts(aggregate.counts(), prior, selected);
            long voters = aggregate.totalVoters() + (vote == null ? 1 : 0);
            BatchStatementBuilder batch = aggregateBatch(pollId, aggregate, counts, voters);
            batch.addStatement(vote == null
                    ? createPollVote.bind(pollId, voterId, selected, Instant.now())
                    : replacePollVote.bind(selected, Instant.now(), pollId, voterId, prior));
            if (session.execute(batch.build()).wasApplied()) {
                return vote == null ? VoteResult.CREATED : VoteResult.UPDATED;
            }
        }
        return VoteResult.CONFLICT;
    }

    @Override
    public VoteResult removeVote(UUID pollId, UUID voterId) {
        for (int attempt = 0; attempt < 3; attempt++) {
            PollAggregate aggregate = loadAggregate(pollId);
            if (aggregate.closed()) return VoteResult.CLOSED;
            Row vote = session.execute(loadPollVote.bind(pollId, voterId)).one();
            if (vote == null) return VoteResult.IDEMPOTENT;
            if (aggregate.totalVoters() < 1) throw new IllegalStateException("poll voter total is inconsistent");
            Set<Integer> prior = Set.copyOf(vote.getSet("selected_option_indexes", Integer.class));
            Map<Integer, Long> counts = adjustCounts(aggregate.counts(), prior, Set.of());
            BatchStatementBuilder batch = aggregateBatch(
                    pollId, aggregate, counts, aggregate.totalVoters() - 1);
            batch.addStatement(removePollVote.bind(pollId, voterId, prior));
            if (session.execute(batch.build()).wasApplied()) return VoteResult.REMOVED;
        }
        return VoteResult.CONFLICT;
    }

    @Override
    public Map<UUID, PollState> findStates(List<UUID> pollIds, UUID voterId) {
        if (pollIds.isEmpty()) return Map.of();
        Map<UUID, PollState> states = new LinkedHashMap<>();
        for (Row row : session.execute(loadPollAggregates.bind(pollIds))) {
            UUID pollId = row.getUuid("poll_id");
            states.put(pollId, new PollState(readCounts(row), Set.of(), row.getLong("total_voters")));
        }
        for (Row row : session.execute(loadPollVotes.bind(pollIds, voterId))) {
            UUID pollId = row.getUuid("poll_id");
            PollState state = states.get(pollId);
            if (state != null) {
                states.put(pollId, new PollState(
                        state.optionCounts(), Set.copyOf(row.getSet("selected_option_indexes", Integer.class)),
                        state.totalVoters()));
            }
        }
        return Map.copyOf(states);
    }

    @Override
    public boolean close(CanonicalPoll poll, UUID actorId, Instant closedAt) {
        boolean stateClosed = session.execute(closePollState.bind(poll.pollId())).wasApplied();
        boolean metadataClosed = session.execute(closePoll.bind(actorId, closedAt, poll.pollId())).wasApplied();
        if (metadataClosed) {
            session.execute(closePollProjection.bind(
                    poll.conversationId(), Uuids.startOf(poll.createdAt().toEpochMilli()), poll.pollId()));
        }
        return stateClosed || metadataClosed;
    }

    private Map<Integer, Long> emptyCounts(int optionCount) {
        Map<Integer, Long> counts = new LinkedHashMap<>();
        for (int index = 0; index < optionCount; index++) counts.put(index, 0L);
        return Map.copyOf(counts);
    }

    private Map<Integer, Long> adjustCounts(
            Map<Integer, Long> current, Set<Integer> prior, Set<Integer> selected) {
        Map<Integer, Long> counts = new LinkedHashMap<>(current);
        for (Integer removed : prior) {
            if (!selected.contains(removed)) {
                Long count = counts.get(removed);
                if (count == null || count < 1) throw new IllegalStateException("poll option count is inconsistent");
                counts.put(removed, count - 1);
            }
        }
        for (Integer added : selected) if (!prior.contains(added)) counts.merge(added, 1L, Long::sum);
        return Map.copyOf(counts);
    }

    private BatchStatementBuilder aggregateBatch(
            UUID pollId, PollAggregate aggregate, Map<Integer, Long> counts, long voters) {
        return BatchStatement.builder(BatchType.LOGGED).addStatement(replacePollAggregate.bind(
                counts, voters, aggregate.version() + 1, pollId, aggregate.version()));
    }

    private PollAggregate loadAggregate(UUID pollId) {
        Row row = session.execute(loadPollAggregate.bind(pollId)).one();
        if (row == null) throw new IllegalStateException("poll aggregate is missing");
        return new PollAggregate(
                readCounts(row), row.getLong("total_voters"), row.getLong("aggregate_version"),
                row.getBoolean("is_closed"));
    }

    private Map<Integer, Long> readCounts(Row row) {
        Map<Integer, Long> counts = row.getMap("option_counts", Integer.class, Long.class);
        if (counts == null) throw new IllegalStateException("poll option counts are missing");
        return Map.copyOf(counts);
    }

    private CanonicalPoll mapPoll(Row row) {
        return new CqlCanonicalRecords.CanonicalPoll(
                row.getUuid("poll_id"), row.getUuid("conversation_id"), row.getString("message_bucket"),
                row.getUuid("message_id"), row.getString("question"), row.getList("options", String.class),
                row.getBoolean("is_multiple_choice"), row.getBoolean("is_anonymous"),
                row.getBoolean("is_closed"), row.getUuid("created_by"), row.getInstant("created_at"),
                row.getInstant("closes_at"), row.getUuid("closed_by"), row.getInstant("closed_at"));
    }

    private record PollAggregate(
            Map<Integer, Long> counts, long totalVoters, long version, boolean closed) {
    }
}
