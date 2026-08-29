package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.ConversationRoleCreateRequest;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationMember;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

class ConversationRoleServiceTest {

    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final CanonicalConversationRepository repository = mock(CanonicalConversationRepository.class);
    private final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AdminConversationDirectoryRepository adminDirectory =
            mock(AdminConversationDirectoryRepository.class);
    private final ConversationRoleService service = new ConversationRoleService(
            store, repository, authorization, events, adminDirectory);

    @Test
    void createsColoredCustomRoleWithBoundedPermissionsAndAudit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of());
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));
        when(repository.createCustomRole(any(), eq(0))).thenReturn(true);

        ConversationRole created = service.create(actorId, conversationId, new ConversationRoleCreateRequest(
                "helpers", "Helpers", "#3366ff", Set.of("MESSAGE_PIN"), false, 200));

        assertThat(created.roleCode()).isEqualTo("HELPERS");
        assertThat(created.colorHex()).isEqualTo("#3366FF");
        assertThat(created.permissions()).containsExactly(ConversationPermission.MESSAGE_PIN);
        verify(repository).createCustomRole(created, 0);
        verify(events).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void returnsTheActorsEffectiveRoomPermissionsAndOwnership() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId))
                .thenReturn(conversation(conversationId, "GROUP", actorId));
        when(authorization.effectivePermissions(conversationId, actorId)).thenReturn(Set.of(
                ConversationPermission.MEMBER_KICK,
                ConversationPermission.ROLE_ASSIGN));

        var view = service.permissions(actorId, conversationId);

        assertThat(view.owner()).isTrue();
        assertThat(view.permissions()).containsExactlyInAnyOrder("MEMBER_KICK", "ROLE_ASSIGN");
    }

    @Test
    void preventsGrantingPermissionActorDoesNotHave() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", UUID.randomUUID()));
        when(repository.findRoles(conversationId)).thenReturn(List.of());
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(Set.of(ConversationPermission.MESSAGE_SEND));

        assertThatThrownBy(() -> service.create(actorId, conversationId, new ConversationRoleCreateRequest(
                "admins", "Admins", "#FF0000", Set.of("MEMBER_KICK"), false, 200)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("cannot grant");
    }

    @Test
    void rejectsACustomRoleCodeWonByAConcurrentCreator() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        ConversationRole competing = new ConversationRole(
                conversationId, 200, UUID.randomUUID(), "HELPERS", "Helpers", "#3366FF",
                Set.of(ConversationPermission.MESSAGE_PIN), false, false,
                actorId, Instant.now(), Instant.now());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of(), List.of(competing));
        when(repository.createCustomRole(any(), eq(0))).thenReturn(false);
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));

        assertThatThrownBy(() -> service.create(actorId, conversationId, new ConversationRoleCreateRequest(
                "helpers", "Helpers", "#3366FF", Set.of("MESSAGE_PIN"), false, 200)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("already exists");

        verify(events, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
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
    void deletesAnUnassignedRoleBehindTheMembershipRevisionBarrier() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        ConversationRole role = new ConversationRole(
                conversationId, 200, roleId, "HELPER", "Helper", "#3366FF",
                Set.of(ConversationPermission.MESSAGE_PIN), false, false,
                actorId, Instant.now(), Instant.now());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of(role));
        when(repository.markRoleDeleting(role)).thenReturn(true);
        when(store.requireConversationRoleRevision(conversationId)).thenReturn(7L);
        when(store.advanceConversationRoleRevision(conversationId, 7L)).thenReturn(true);
        when(repository.findMembers(conversationId)).thenReturn(List.of());
        when(repository.findCustomRoleCount(conversationId)).thenReturn(1);
        when(repository.deleteCustomRole(role, 1)).thenReturn(true);

        service.delete(actorId, conversationId, roleId);

        verify(repository).deleteCustomRole(role, 1);
        verify(repository, never()).restoreRoleActive(role);
        verify(events).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void restoresARoleWhenTheRevisionBarrierFindsAnAssignment() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        ConversationRole role = new ConversationRole(
                conversationId, 200, roleId, "HELPER", "Helper", "#3366FF",
                Set.of(ConversationPermission.MESSAGE_PIN), false, false,
                actorId, Instant.now(), Instant.now());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findRoles(conversationId)).thenReturn(List.of(role));
        when(repository.markRoleDeleting(role)).thenReturn(true);
        when(store.requireConversationRoleRevision(conversationId)).thenReturn(3L);
        when(store.advanceConversationRoleRevision(conversationId, 3L)).thenReturn(true);
        when(repository.findMembers(conversationId)).thenReturn(List.of(member(conversationId, targetId, Set.of(roleId))));

        assertThatThrownBy(() -> service.delete(actorId, conversationId, roleId))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("assigned");

        verify(repository).restoreRoleActive(role);
        verify(repository, never()).deleteCustomRole(any(), org.mockito.ArgumentMatchers.anyInt());
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
        when(store.requireConversationRoleRevision(conversationId)).thenReturn(4L);
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));

        when(store.updateMemberRolesIfUnchanged(
                conversationId, targetId, Set.of(), Set.of(roleId), 4L)).thenReturn(true);

        service.assign(actorId, conversationId, targetId, Set.of(roleId));

        verify(store).updateMemberRolesIfUnchanged(
                conversationId, targetId, Set.of(), Set.of(roleId), 4L);
        verify(store).updateConversationProjectionRoles(targetId, conversationId, Set.of(roleId));
    }

    @Test
    void roleAssignmentRejectsAConcurrentAuthorityChange() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        ConversationRole role = new ConversationRole(
                conversationId, 200, roleId, "HELPER", "Helper", "#3366FF",
                Set.of(ConversationPermission.MESSAGE_PIN), false, false,
                actorId, Instant.now(), Instant.now());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findMember(conversationId, targetId)).thenReturn(member(conversationId, targetId, Set.of()));
        when(repository.findRoles(conversationId)).thenReturn(List.of(role));
        when(store.requireConversationRoleRevision(conversationId)).thenReturn(4L);
        when(authorization.effectivePermissions(conversationId, actorId))
                .thenReturn(EnumSet.allOf(ConversationPermission.class));
        when(store.updateMemberRolesIfUnchanged(
                conversationId, targetId, Set.of(), Set.of(roleId), 4L)).thenReturn(false);

        assertThatThrownBy(() -> service.assign(actorId, conversationId, targetId, Set.of(roleId)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("changed concurrently");

        verify(store, never()).updateConversationProjectionRoles(any(), any(), any());
        verify(events, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void transfersOwnershipThroughOneAuthoritativeMembershipMutation() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID ownerRoleId = UUID.randomUUID();
        UUID memberRoleId = UUID.randomUUID();
        CanonicalConversation before = conversation(conversationId, "GROUP", actorId);
        CanonicalConversation after = conversation(conversationId, "GROUP", targetId);
        ConversationMember currentOwner = member(conversationId, actorId, Set.of(ownerRoleId));
        ConversationMember nextOwner = member(conversationId, targetId, Set.of(memberRoleId));
        when(store.findConversation(conversationId)).thenReturn(before, after);
        when(repository.findMember(conversationId, actorId)).thenReturn(currentOwner);
        when(repository.findMember(conversationId, targetId)).thenReturn(nextOwner);
        when(repository.findRoles(conversationId)).thenReturn(List.of(
                role(conversationId, ownerRoleId, "OWNER", false, true),
                role(conversationId, memberRoleId, "MEMBER", true, true)));
        when(store.transferConversationOwnership(
                conversationId, 0L, actorId, targetId,
                Set.of(ownerRoleId), Set.of(memberRoleId),
                Set.of(memberRoleId), Set.of(memberRoleId, ownerRoleId)))
                .thenReturn(CanonicalCqlStore.OwnershipTransferResult.TRANSFERRED);

        service.transferOwnership(actorId, conversationId, targetId);

        verify(store).updateConversationProjectionRoles(actorId, conversationId, Set.of(memberRoleId));
        verify(store).updateConversationProjectionRoles(
                targetId, conversationId, Set.of(memberRoleId, ownerRoleId));
        verify(adminDirectory).index(after);
        verify(events).record(
                actorId, conversationId, "OWNERSHIP_TRANSFERRED", "conversation",
                conversationId.toString(), targetId, null,
                java.util.Map.of("ownerId", actorId.toString()),
                java.util.Map.of("ownerId", targetId.toString()));
    }

    @Test
    void rejectsOwnershipTransferWhenAuthorityChangedConcurrently() {
        UUID actorId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID ownerRoleId = UUID.randomUUID();
        ConversationMember currentOwner = member(conversationId, actorId, Set.of(ownerRoleId));
        ConversationMember nextOwner = member(conversationId, targetId, Set.of());
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, "GROUP", actorId));
        when(repository.findMember(conversationId, actorId)).thenReturn(currentOwner);
        when(repository.findMember(conversationId, targetId)).thenReturn(nextOwner);
        when(repository.findRoles(conversationId)).thenReturn(List.of(
                role(conversationId, ownerRoleId, "OWNER", false, true)));
        when(store.transferConversationOwnership(
                conversationId, 0L, actorId, targetId,
                Set.of(ownerRoleId), Set.of(), Set.of(), Set.of(ownerRoleId)))
                .thenReturn(CanonicalCqlStore.OwnershipTransferResult.CHANGED_CONCURRENTLY);

        assertThatThrownBy(() -> service.transferOwnership(actorId, conversationId, targetId))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("changed concurrently");

        verify(events, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(adminDirectory, never()).index(any());
    }

    @Test
    void repeatedOwnershipTransferRepairsProjectionsWithoutAnotherMutationOrAudit() {
        UUID previousOwnerId = UUID.randomUUID();
        UUID currentOwnerId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        ConversationMember previousOwner = member(conversationId, previousOwnerId, Set.of());
        ConversationMember currentOwner = member(conversationId, currentOwnerId, Set.of(UUID.randomUUID()));
        CanonicalConversation conversation = conversation(conversationId, "GROUP", currentOwnerId);
        when(store.findConversation(conversationId)).thenReturn(conversation, conversation);
        when(repository.findMember(conversationId, previousOwnerId)).thenReturn(previousOwner);
        when(repository.findMember(conversationId, currentOwnerId)).thenReturn(currentOwner);

        service.transferOwnership(previousOwnerId, conversationId, currentOwnerId);

        verify(store, never()).transferConversationOwnership(
                any(), org.mockito.ArgumentMatchers.anyLong(), any(), any(), any(), any(), any(), any());
        verify(store).updateConversationProjectionRoles(
                previousOwnerId, conversationId, previousOwner.roleIds());
        verify(store).updateConversationProjectionRoles(
                currentOwnerId, conversationId, currentOwner.roleIds());
        verify(adminDirectory).index(conversation);
        verify(events, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    private ConversationMember member(UUID conversationId, UUID userId, Set<UUID> roleIds) {
        return new ConversationMember(
                conversationId, userId, roleIds, Instant.now(), null,
                null, null, "INHERIT", null, null);
    }

    private ConversationRole role(
            UUID conversationId,
            UUID roleId,
            String roleCode,
            boolean isDefault,
            boolean isSystem) {
        return new ConversationRole(
                conversationId, "OWNER".equals(roleCode) ? 10_000 : 1,
                roleId, roleCode, roleCode, "#F97316",
                EnumSet.allOf(ConversationPermission.class), isDefault, isSystem,
                UUID.randomUUID(), Instant.now(), Instant.now());
    }

    private CanonicalConversation conversation(UUID id, String type, UUID ownerId) {
        return new CanonicalConversation(id, type, "PRIVATE_LINK", "INVITE_ONLY", "Room", "room", null,
                null, null, ownerId, ownerId, Instant.now(), Instant.now(), false, null, "OPEN", 0,
                null, "ALL", null, Set.of(), null, null, 1, false, Instant.now());
    }
}
