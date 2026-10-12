package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.ConflictException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationBanServiceTest {
    @Mock ConversationModerationRepository bans;
    @Mock CanonicalCqlStore store;
    @Mock ConversationAuthorizationService authorization;
    @Mock CanonicalEventRecorder events;
    @Mock AdminConversationDirectoryRepository adminDirectory;
    @Mock UserRepository users;

    private ConversationBanService service;

    @BeforeEach
    void setUp() {
        service = new ConversationBanService(bans, store, authorization, events, adminDirectory, users);
    }

    @Test
    void banIsWrittenBeforeMembershipIsRemovedSoRetryRemainsSafe() {
        UUID actorId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        CanonicalConversation conversation = conversation(conversationId, ownerId);
        when(store.findConversation(conversationId)).thenReturn(conversation);
        when(store.findConversationMember(conversationId, userId)).thenReturn(member(conversationId, userId));
        when(store.tryRemoveConversationMember(conversationId, userId))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.REMOVED);

        service.ban(actorId, conversationId, userId,
                new CanonicalApiContracts.ConversationBanRequest("SPAM", "Repeated spam", null));

        verify(authorization).requirePermission(conversationId, actorId, ConversationPermission.MEMBER_BAN);
        InOrder order = inOrder(bans, store);
        order.verify(bans).ban(conversationId, userId, actorId, "SPAM", "Repeated spam", null);
        order.verify(store).tryRemoveConversationMember(conversationId, userId);
        verify(events).record(eq(actorId), eq(conversationId), eq("MEMBER_BAN"),
                eq("conversation_member"), eq(userId.toString()), eq(userId), eq("Repeated spam"), any(), any());
    }

    @Test
    void ownerCannotBeBanned() {
        UUID actorId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, ownerId));

        assertThatThrownBy(() -> service.ban(actorId, conversationId, ownerId,
                new CanonicalApiContracts.ConversationBanRequest("OTHER", "Reason", null)))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("owner");

        verify(bans, never()).ban(any(), any(), any(), any(), any(), any());
        verify(store, never()).tryRemoveConversationMember(any(), any());
    }

    private CanonicalConversation conversation(UUID conversationId, UUID ownerId) {
        Instant now = Instant.now();
        return new CanonicalConversation(
                conversationId, "CHANNEL", "COMMUNITY", "DIRECT_JOIN", "Community", "community",
                null, null, null, ownerId, ownerId, now, now, false, null, "OPEN", 0,
                null, "ALL", null, Set.of(), "vi", 100, 2, false, now);
    }

    private CanonicalConversationMember member(UUID conversationId, UUID userId) {
        return new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.now(), null, null, null, "INHERIT", null, null);
    }
}
