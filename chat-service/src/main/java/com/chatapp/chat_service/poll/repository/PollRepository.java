package com.chatapp.chat_service.poll.repository;

import com.chatapp.chat_service.poll.entity.Poll;
import org.springframework.data.cassandra.repository.CassandraRepository;
import org.springframework.data.cassandra.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PollRepository extends CassandraRepository<Poll, UUID> {
    
    @Query("SELECT * FROM polls WHERE message_id = ?0")
    Optional<Poll> findByMessageId(UUID messageId);
}
