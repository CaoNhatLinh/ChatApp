package com.chatapp.chat_service.poll.repository;

import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import com.chatapp.chat_service.poll.entity.PollVote;

import java.util.List;
import java.util.UUID;

@Repository
public interface PollVoteRepository extends CassandraRepository<PollVote, PollVote.PollVoteKey> {

    @Query("SELECT * FROM poll_votes WHERE poll_id = ?0")
    List<PollVote> findByPollId(UUID pollId);

    @Query("SELECT * FROM poll_votes WHERE poll_id = ?0 AND user_id = ?1")
    PollVote findByPollIdAndUserId(UUID pollId, UUID userId);

    @Query("SELECT COUNT(*) FROM poll_votes WHERE poll_id = ?0")
    long countByPollId(UUID pollId);

    @Query("DELETE FROM poll_votes WHERE poll_id = ?0 AND user_id = ?1")
    void deleteByPollIdAndUserId(UUID pollId, UUID userId);
}
