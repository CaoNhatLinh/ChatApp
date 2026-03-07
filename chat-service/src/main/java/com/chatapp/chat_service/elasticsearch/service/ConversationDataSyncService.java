package com.chatapp.chat_service.elasticsearch.service;

import com.chatapp.chat_service.conversation.entity.Conversation;
import com.chatapp.chat_service.conversation.repository.ConversationMemberRepository;
import com.chatapp.chat_service.conversation.repository.ConversationRepository;
import com.chatapp.chat_service.elasticsearch.document.ConversationDocument;
import com.chatapp.chat_service.elasticsearch.repository.ConversationElasticsearchRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "elasticsearch.enabled", havingValue = "true")
public class ConversationDataSyncService implements CommandLineRunner {

    private final ConversationRepository conversationRepository;
    private final ConversationMemberRepository conversationMemberRepository;
    private final ConversationElasticsearchRepository elasticsearchRepository;

    @Override
    public void run(String... args) throws Exception {
        try {
            log.info("Starting conversation data synchronization to Elasticsearch...");
            syncAllConversations();
            log.info("Conversation data synchronization completed successfully");
        } catch (Exception e) {
            log.error("Failed to sync conversation data to Elasticsearch", e);
        }
    }

    public void syncAllConversations() {
        try {
            elasticsearchRepository.deleteAll();
            log.info("Cleared existing Elasticsearch conversation data");

            List<Conversation> conversations = conversationRepository.findAll();
            log.info("Found {} conversations to sync", conversations.size());

            for (Conversation conversation : conversations) {
                try {
                    syncSingleConversation(conversation);
                } catch (Exception e) {
                    log.error("Failed to sync conversation: {}", conversation.getConversationId(), e);
                }
            }

            log.info("Successfully synced {} conversations to Elasticsearch", conversations.size());
        } catch (Exception e) {
            log.error("Error during conversation data synchronization", e);
            throw e;
        }
    }

    private void syncSingleConversation(Conversation conversation) {
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
        log.debug("Synced conversation: {} with {} members", conversation.getConversationId(), memberIds.size());
    }
}
