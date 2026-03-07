package com.chatapp.chat_service.elasticsearch.repository;

import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConversationElasticsearchRepository extends ElasticsearchRepository<ConversationDocument, String> {
    
    Page<ConversationDocument> findByIsDeletedFalseAndMemberIdsContainingOrderByLastMessage_CreatedAtDesc(
            UUID memberId, Pageable pageable);
    
    Page<ConversationDocument> findByIsDeletedFalseAndMemberIdsContainingAndNameContainingIgnoreCaseOrderByLastMessage_CreatedAtDesc(
            UUID memberId, String name, Pageable pageable);
    
    Page<ConversationDocument> findByIsDeletedFalseAndMemberIdsContainingAndTypeOrderByLastMessage_CreatedAtDesc(
            UUID memberId, String type, Pageable pageable);
    
    Page<ConversationDocument> findByIsDeletedFalseAndMemberIdsContainingAndNameContainingIgnoreCaseAndTypeOrderByLastMessage_CreatedAtDesc(
            UUID memberId, String name, String type, Pageable pageable);
    
    List<ConversationDocument> findByConversationId(UUID conversationId);
}
