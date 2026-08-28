package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.ConversationRoleRequest;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConversationRoleServiceTest {

    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final CanonicalConversationRepository repository = mock(CanonicalConversationRepository.class);
    private final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final ConversationRoleService service = new ConversationRoleService(store, repository, authorization, events);

    @Test
    void createsColoredCustomRoleWithBoundedPermissionsAndAudit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of());
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));

        ConversationRole created = service.create(actorId, conversationId, new ConversationRoleRequest(
                "helpers", "Helpers", "#3366ff", Set.of("MESSAGE_PIN"), false, 200, null, null));

        assertThat(created.roleCode()).isEqualTo("HELPERS");
        assertThat(created.colorHex()).isEqualTo("#3366FF");
        assertThat(created.permissions()).containsExactly(ConversationPermission.MESSAGE_PIN);
        verify(repository).saveRole(created);
        verify(events).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void preventsGrantingPermissionActorDoesNotHave() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", UUID.randomUUID()));
        when(repository.findRoles(conversationId)).thenReturn(List.of());
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(Set.of(ConversationPermission.MESSAGE_SEND));

        assertThatThrownBy(() -> service.create(actorId, conversationId, new ConversationRoleRequest(
                "admins", "Admins", "#FF0000", Set.of("MEMBER_KICK"), false, 200, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot grant");
    }

    @Test
    void refusesToDeleteProtectedSystemRole() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of(new ConversationRole(
                conversationId, 0, roleId, "OWNER", "Owner", "#F59E0B",
                EnumSet.allOf(ConversationPermission.class), false, true, actorId, Instant.now(), Instant.now())));

        assertThatThrownBy(() -> service.delete(actorId, conversationId, roleId))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("system roles");
    }

    @Test
    void assignsValidatedRolesAndUpdatesRoomListProjection() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        ConversationRole role = new ConversationRole(
                conversationId, 200, roleId, "HELPER", "Helper", "#3366FF",
                Set.of(ConversationPermission.MESSAGE_PIN), false, false, actorId, Instant.now(), Instant.now());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findMember(conversationId, targetId)).thenReturn(new ConversationMember(
                conversationId, targetId, Set.of(), Instant.now(), actorId, null, null, "INHERIT", null, null));
        when(repository.findRoles(conversationId)).thenReturn(List.of(role));
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));

        service.assign(actorId, conversationId, targetId, Set.of(roleId));

        ArgumentCaptor<ConversationMember> member = ArgumentCaptor.forClass(ConversationMember.class);
        verify(repository).saveMember(member.capture());
        assertThat(member.getValue().roleIds()).containsExactly(roleId);
        verify(store).updateConversationProjectionRoles(targetId, conversationId, Set.of(roleId));
    }

    private CanonicalConversation conversation(UUID id, String type, UUID ownerId) {
        return new CanonicalConversation(id, type, "PRIVATE_LINK", "INVITE_ONLY", "Room", "room", null,
                null, null, ownerId, ownerId, Instant.now(), Instant.now(), false, null, "OPEN", 0,
                null, "ALL", null, Set.of(), null, null, 1, false, Instant.now());
    }
}
