package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
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
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentCaptor.forClass;

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

    @Test
    void addMemberRejectsInactiveAccountsBeforeMutatingMembership() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.findUserById(invitedUserId)).thenReturn(new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser(
                invitedUserId, "disabled", "disabled", "disabled@example.com", "disabled@example.com",
                "hash", "LOCAL", null, "Disabled", null, "DISABLED", Instant.now(), Instant.now(), null));

        assertThatThrownBy(() -> service.addMember(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationMemberRequest(invitedUserId, Set.of(), "invite")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.BadRequestException.class)
                .hasMessageContaining("active");

        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void repeatedAddMemberRepairsProjectionWithoutDuplicatingAudit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.findUserById(invitedUserId)).thenReturn(activeUser(invitedUserId));
        when(store.tryAddConversationMember(any())).thenReturn(
                CanonicalCqlStore.MembershipMutationResult.ALREADY_MEMBER);
        CanonicalConversationMember existingMember = member(conversationId, invitedUserId);
        when(store.findConversationMember(conversationId, invitedUserId)).thenReturn(existingMember);

        service.addMember(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationMemberRequest(invitedUserId, Set.of(), "invite"));

        verify(store).addConversationMembershipProjection(eq(invitedUserId), any(), eq(existingMember));
        verify(adminConversationDirectory).index(any());
        verify(eventRecorder, never()).record(
                eq(actorId), eq(conversationId), eq("MEMBER_ADD"), eq("conversation"),
                eq(conversationId.toString()), eq(invitedUserId), any(), any(), any());
    }

    @Test
    void addMemberRejectsAFullConversationWithoutWritingProjection() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.findUserById(invitedUserId)).thenReturn(activeUser(invitedUserId));
        when(store.tryAddConversationMember(any())).thenReturn(
                CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED);

        assertThatThrownBy(() -> service.addMember(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationMemberRequest(invitedUserId, Set.of(), "invite")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("capacity");

        verify(store, never()).addConversationMembershipProjection(eq(invitedUserId), any(), any());
    }

    @Test
    void addMemberWritesProjectionAndAuditOnlyAfterTheAtomicMembershipClaim() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        CanonicalConversation conversation = conversation(conversationId, actorId, "ALL");
        when(store.findConversation(conversationId)).thenReturn(conversation);
        when(store.findUserById(invitedUserId)).thenReturn(activeUser(invitedUserId));
        when(store.tryAddConversationMember(any())).thenReturn(CanonicalCqlStore.MembershipMutationResult.ADDED);

        service.addMember(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationMemberRequest(invitedUserId, Set.of(), "invite"));

        var memberCaptor = forClass(CanonicalConversationMember.class);
        verify(store).tryAddConversationMember(memberCaptor.capture());
        verify(store).addConversationMembershipProjection(invitedUserId, conversation, memberCaptor.getValue());
        verify(adminConversationDirectory).index(conversation);
        verify(eventRecorder).record(
                eq(actorId), eq(conversationId), eq("MEMBER_ADD"), eq("conversation"),
                eq(conversationId.toString()), eq(invitedUserId), any(), any(), any());
    }

    @Test
    void concurrentMemberRemovalDoesNotDuplicateTheAuditEvent() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID removedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.findConversationMember(conversationId, removedUserId)).thenReturn(member(conversationId, removedUserId));
        when(store.tryRemoveConversationMember(conversationId, removedUserId))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.NOT_MEMBER);

        service.removeMember(actorId, conversationId, removedUserId);

        verify(adminConversationDirectory).index(any());
        verify(eventRecorder, never()).record(
                eq(actorId), eq(conversationId), eq("MEMBER_REMOVE"), eq("conversation"),
                eq(conversationId.toString()), eq(removedUserId), any(), any(), any());
    }

    @Test
    void directInviteDoesNotConsumeAUseWhenTheConversationIsAlreadyFull() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(store.findInviteByToken(invite.linkToken())).thenReturn(invite);
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(10, 10));

        CanonicalApiContracts.InviteConsumeResponse response = service.consumeInvite(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("CAPACITY_REACHED");
        verify(store, never()).consumeInvite(any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void repeatedDirectInviteRepairsMembershipProjectionsWithoutConsumingAnotherUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        CanonicalConversationMember existingMember = member(invite.conversationId(), actorId);
        CanonicalConversation conversation = conversation(invite.conversationId(), UUID.randomUUID(), "ALL");
        when(store.findInviteByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversationMember(invite.conversationId(), actorId)).thenReturn(existingMember);
        when(store.findConversation(invite.conversationId())).thenReturn(conversation);

        CanonicalApiContracts.InviteConsumeResponse response = service.consumeInvite(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("ALREADY_MEMBER");
        verify(store).addConversationMembershipProjection(actorId, conversation, existingMember);
        verify(adminConversationDirectory).index(conversation);
        verify(store, never()).consumeInvite(any(), any());
    }

    @Test
    void directInviteReleasesItsUseWhenCapacityIsReachedDuringTheMembershipClaim() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(store.findInviteByToken(invite.linkToken())).thenReturn(invite);
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(9, 10));
        when(store.consumeInvite(invite.linkToken(), actorId))
                .thenReturn(CanonicalCqlStore.InviteConsumeResult.CONSUMED);
        when(store.tryAddConversationMember(any()))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED);

        CanonicalApiContracts.InviteConsumeResponse response = service.consumeInvite(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("CAPACITY_REACHED");
        verify(store).releaseInviteUse(invite, actorId);
    }

    @Test
    void concurrentAcceptedInviteNeverReleasesAnotherRequestUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(store.findInviteByToken(invite.linkToken())).thenReturn(invite);
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(1, 10));
        when(store.consumeInvite(invite.linkToken(), actorId))
                .thenReturn(CanonicalCqlStore.InviteConsumeResult.ALREADY_ACCEPTED);

        CanonicalApiContracts.InviteConsumeResponse response = service.consumeInvite(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("RETRY_REQUIRED");
        verify(store, never()).releaseInviteUse(any(), any());
        verify(store, never()).tryAddConversationMember(any());
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

    private CanonicalInviteLink invite(UUID conversationId) {
        Instant now = Instant.now();
        return new CanonicalInviteLink(
                UUID.randomUUID(), "invite-token", conversationId, UUID.randomUUID(), now,
                "ROOM", "DIRECT_JOIN", "Invite", now.plusSeconds(3600), true,
                10, 0, null, null);
    }

    private com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser activeUser(UUID userId) {
        return new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser(
                userId, "active", "active", "active@example.com", "active@example.com",
                "hash", "LOCAL", null, "Active", null, "ACTIVE", Instant.now(), Instant.now(), null);
    }
}
