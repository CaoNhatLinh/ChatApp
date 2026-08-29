package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.common.exception.ForbiddenException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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

    @Test
    void memberCanChangeOnlyTheirOwnNotificationOverride() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId));

        service.updateMemberNotificationPolicy(
                actorId,
                conversationId,
                actorId,
                new CanonicalApiContracts.MemberNotificationPolicyRequest("MENTIONS"));

        verify(store).updateMemberNotificationPolicy(conversationId, actorId, "MENTIONS");
        verify(eventRecorder).record(
                actorId, conversationId, "MEMBER_NOTIFICATION_POLICY_UPDATE", "conversation_member",
                actorId.toString(), actorId, null,
                Map.of("notificationOverride", "INHERIT"), Map.of("notificationOverride", "MENTIONS"));

        UUID anotherUserId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateMemberNotificationPolicy(
                actorId,
                conversationId,
                anotherUserId,
                new CanonicalApiContracts.MemberNotificationPolicyRequest("NONE")))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void roomOwnerCanOnlyReduceTheRoomNotificationDefault() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(
                conversation(conversationId, actorId, "ALL"),
                conversation(conversationId, actorId, "NONE"));

        service.updateConversationNotificationPolicy(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationNotificationPolicyRequest("NONE"));

        verify(authorization).requirePermission(conversationId, actorId, ConversationPermission.ROOM_UPDATE);
        verify(store).updateConversationNotificationPolicy(
                org.mockito.ArgumentMatchers.eq(conversationId),
                org.mockito.ArgumentMatchers.eq("NONE"),
                org.mockito.ArgumentMatchers.any(Instant.class));
        assertThatThrownBy(() -> service.updateConversationNotificationPolicy(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationNotificationPolicyRequest("ALL")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
    }

    private CanonicalConversationMember member(UUID conversationId, UUID userId) {
        return new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.now(), null, null, null, "INHERIT", null, null);
    }

    private CanonicalConversation conversation(UUID conversationId, UUID ownerId, String defaultNotificationLevel) {
        Instant now = Instant.now();
        return new CanonicalConversation(
                conversationId, "GROUP", "PRIVATE", "INVITE_ONLY", "Room", "room", null, null, null,
                ownerId, ownerId, now, now, false, null, "OPEN", 0, null, defaultNotificationLevel,
                null, Set.of(), "vi", 10, 1, false, now);
    }
}
