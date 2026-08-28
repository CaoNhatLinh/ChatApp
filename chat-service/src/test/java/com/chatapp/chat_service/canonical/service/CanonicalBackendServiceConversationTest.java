package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.UUID;
import java.time.Instant;
import java.util.Set;
import java.util.Map;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalBackendServiceConversationTest {

    @Mock CanonicalCqlStore store;
    @Mock PasswordEncoder passwordEncoder;
    @Mock JwtTokenProvider tokenProvider;
    @Mock CanonicalConversationRepository conversationRepository;
    @Mock ConversationAuthorizationService authorization;
    @Mock CanonicalEventRecorder eventRecorder;
    @Mock ChatPolicyService chatPolicy;
    @Mock SimpMessagingTemplate messaging;
    @Mock AdminConversationDirectoryRepository adminConversationDirectory;

    private CanonicalBackendService service;

    @BeforeEach
    void setUp() {
        service = new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);
    }

    @Test
    void unpinResolvesTheInternalSlotFromTheConversationId() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId));
        when(store.unpinConversation(actorId, conversationId)).thenReturn(true);

        service.unpinConversation(actorId, conversationId);

        verify(store).unpinConversation(actorId, conversationId);
        verify(eventRecorder).record(
                actorId, conversationId, "CONVERSATION_UNPIN", "conversation",
                conversationId.toString(), null, null, Map.of(), Map.of());
    }

    @Test
    void repeatedUnpinIsAnIdempotentNoOp() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId));
        when(store.unpinConversation(actorId, conversationId)).thenReturn(false);

        service.unpinConversation(actorId, conversationId);

        verify(eventRecorder, never()).record(
                actorId, conversationId, "CONVERSATION_UNPIN", "conversation",
                conversationId.toString(), null, null, Map.of(), Map.of());
    }

    private CanonicalConversationMember member(UUID conversationId, UUID userId) {
        return new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.now(), null, null, null, "INHERIT", null, null);
    }
}
