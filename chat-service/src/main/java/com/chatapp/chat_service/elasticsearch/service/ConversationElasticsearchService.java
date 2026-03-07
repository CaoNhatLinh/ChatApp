package com.chatapp.chat_service.elasticsearch.service;

import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.conversation.entity.ConversationMembers;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import com.chatapp.chat_service.elasticsearch.repository.ConversationElasticsearchRepository;
import com.chatapp.chat_service.message.dto.MessageSummary;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
@Slf4j
public class ConversationElasticsearchService {

    private final ConversationElasticsearchRepository elasticsearchRepository;
    private final ConversationMemberRepository conversationMemberRepository;

    public Page<ConversationDocument> searchConversations(UUID userId, String name, String type, Pageable pageable) {
        if (name != null && !name.trim().isEmpty() && type != null && !type.trim().isEmpty()) {
            return elasticsearchRepository.findByIsDeletedFalseAndMemberIdsContainingAndNameContainingIgnoreCaseAndTypeOrderByLastMessage_CreatedAtDesc(
                    userId, name.trim(), type.toUpperCase(), pageable);
        } else if (name != null && !name.trim().isEmpty()) {
            return elasticsearchRepository.findByIsDeletedFalseAndMemberIdsContainingAndNameContainingIgnoreCaseOrderByLastMessage_CreatedAtDesc(
                    userId, name.trim(), pageable);
        } else if (type != null && !type.trim().isEmpty()) {
            return elasticsearchRepository.findByIsDeletedFalseAndMemberIdsContainingAndTypeOrderByLastMessage_CreatedAtDesc(
                    userId, type.toUpperCase(), pageable);
        } else {
            return elasticsearchRepository.findByIsDeletedFalseAndMemberIdsContainingOrderByLastMessage_CreatedAtDesc(
                    userId, pageable);
        }
    }

    public void indexConversation(Conversation conversation) {
        try {
            List<UUID> memberIds = conversationMemberRepository.findAllByKeyConversationId(conversation.getConversationId())
                    .stream()
                    .map(member -> member.getKey().getUserId())
                    .collect(Collectors.toList());

            ConversationDocument document = ConversationDocument.builder()
                    .id(conversation.getConversationId().toString())
                    .conversationId(conversation.getConversationId())
                    .name(conversation.getName())
                    .type(conversation.getType())
                    .isDeleted(conversation.isDeleted())
                    .createdAt(conversation.getCreatedAt())
                    .updatedAt(conversation.getUpdatedAt())
                    .lastMessage(conversation.getLastMessage())
                    .createdBy(conversation.getCreatedBy())
                    .description(conversation.getDescription())
                    .avatar(conversation.getBackgroundUrl())
                    .memberIds(memberIds)
                    .memberCount(memberIds.size())
                    .build();

            elasticsearchRepository.save(document);
            log.info("Indexed conversation: {}", conversation.getConversationId());
        } catch (Exception e) {
            log.error("Failed to index conversation: {}", conversation.getConversationId(), e);
        }
    }

    public void deleteConversation(UUID conversationId) {
        try {
            List<ConversationDocument> documents = elasticsearchRepository.findByConversationId(conversationId);
            if (!documents.isEmpty()) {
                ConversationDocument document = documents.get(0);
                document.setDeleted(true);
                elasticsearchRepository.save(document);
                log.info("Marked conversation as deleted in Elasticsearch: {}", conversationId);
            }
        } catch (Exception e) {
            log.error("Failed to mark conversation as deleted: {}", conversationId, e);
        }
    }

    public void restoreConversation(UUID conversationId) {
        try {
            List<ConversationDocument> documents = elasticsearchRepository.findByConversationId(conversationId);
            if (!documents.isEmpty()) {
                ConversationDocument document = documents.get(0);
                document.setDeleted(false);
                elasticsearchRepository.save(document);
                log.info("Restored conversation in Elasticsearch: {}", conversationId);
            }
        } catch (Exception e) {
            log.error("Failed to restore conversation: {}", conversationId, e);
        }
    }

    public void updateLastMessage(UUID conversationId, MessageSummary messageSummary) {
        try {
            List<ConversationDocument> documents = elasticsearchRepository.findByConversationId(conversationId);
            if (!documents.isEmpty()) {
                ConversationDocument document = documents.get(0);
                document.setLastMessage(messageSummary);
                elasticsearchRepository.save(document);
                log.debug("Updated last message for conversation: {}", conversationId);
            }
        } catch (Exception e) {
            log.error("Failed to update last message for conversation: {}", conversationId, e);
        }
    }
}
