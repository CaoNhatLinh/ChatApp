package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ConversationAuthorizationServiceTest {

    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final CanonicalConversationRepository roles = mock(CanonicalConversationRepository.class);
    private final ConversationAuthorizationService authorization = new ConversationAuthorizationService(store, roles);

    @Test
    void grantsUnionOfAssignedCustomRolePermissions() {
        UUID conversationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", UUID.randomUUID()));
        when(store.findConversationMember(conversationId, userId)).thenReturn(member(conversationId, userId, Set.of(roleId)));
        when(roles.findRoles(conversationId)).thenReturn(List.of(role(conversationId, roleId, ConversationPermission.MESSAGE_PIN)));

        authorization.requirePermission(conversationId, userId, ConversationPermission.MESSAGE_PIN);
    }

    @Test
    void deniesPermissionThatNoAssignedRoleContains() {
        UUID conversationId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", UUID.randomUUID()));
        when(store.findConversationMember(conversationId, userId)).thenReturn(member(conversationId, userId, Set.of()));
        when(roles.findRoles(conversationId)).thenReturn(List.of());

        assertThatThrownBy(() -> authorization.requirePermission(
                conversationId, userId, ConversationPermission.MEMBER_KICK))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void acceptsOnlyASecondMemberOfADirectConversationAsCallPeer() {
        UUID conversationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID peerId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "DM", actorId));
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId, Set.of()));
        when(store.findConversationMember(conversationId, peerId)).thenReturn(member(conversationId, peerId, Set.of()));

        authorization.requireDirectPeer(conversationId, actorId, peerId);
    }

    @Test
    void rejectsGroupConversationCallPeer() {
        UUID conversationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID peerId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));

        assertThatThrownBy(() -> authorization.requireDirectPeer(conversationId, actorId, peerId))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsPeerOutsideDirectConversation() {
        UUID conversationId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID peerId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "DM", actorId));
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId, Set.of()));

        assertThatThrownBy(() -> authorization.requireDirectPeer(conversationId, actorId, peerId))
                .isInstanceOf(ForbiddenException.class);
    }

    private CanonicalConversation conversation(UUID id, String type, UUID ownerId) {
        return new CanonicalConversation(id, type, "PRIVATE_LINK", "INVITE_ONLY", "Room", "room", null,
                null, null, ownerId, ownerId, Instant.now(), Instant.now(), false, null, "OPEN", 0,
                null, "ALL", null, Set.of(), null, null, 1, false, Instant.now());
    }

    private CanonicalConversationMember member(UUID conversationId, UUID userId, Set<UUID> roleIds) {
        return new CanonicalConversationMember(conversationId, userId, roleIds, Instant.now(), null,
                null, null, "INHERIT", null, Instant.now());
    }

    private ConversationRole role(UUID conversationId, UUID roleId, ConversationPermission permission) {
        return new ConversationRole(conversationId, 10, roleId, "CUSTOM", "Custom", "#3366FF",
                Set.of(permission), false, false, UUID.randomUUID(), Instant.now(), Instant.now());
    }
}
