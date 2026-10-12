package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.community.CommunityService;
import com.chatapp.chat_service.canonical.invite.InviteService;
import com.chatapp.chat_service.canonical.invite.JoinRequestService;
import com.chatapp.chat_service.canonical.invite.InviteRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;
import java.time.Instant;
import java.util.Set;
import java.util.Map;
import java.util.List;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentCaptor.forClass;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock CanonicalCqlStore store;
    @Mock InviteRepository inviteRepository;
    @Mock CanonicalConversationRepository conversationRepository;
    @Mock ConversationAuthorizationService authorization;
    @Mock CanonicalEventRecorder eventRecorder;
    @Mock NotificationService notificationService;
    @Mock AdminConversationDirectoryRepository adminConversationDirectory;
    @Mock UserRepository users;
    @Mock ConversationEntryPolicy entryPolicy;

    private ConversationService service;
    private CommunityService communities;
    private InviteService invites;
    private JoinRequestService joinRequests;

    @BeforeEach
    void setUp() {
        ConversationMembershipService memberships =
                new ConversationMembershipService(store, conversationRepository, adminConversationDirectory,
                        entryPolicy);
        service = new ConversationService(
                store, conversationRepository, authorization, eventRecorder, adminConversationDirectory, users,
                memberships);
        communities = new CommunityService(store, memberships, eventRecorder);
        invites = new InviteService(
                store, inviteRepository, authorization, memberships, eventRecorder,
                "http://localhost:5173");
        joinRequests = new JoinRequestService(
                store, inviteRepository, authorization, memberships, eventRecorder, notificationService);
    }

    @Test
    void invalidDmTargetCannotReserveThePair() {
        UUID target = UUID.randomUUID();
        var request = new CanonicalApiContracts.ConversationCreateRequest(
                "DM", null, null, "DM", null, null, null, null, null, Set.of(), null,
                2, null, "OPEN", 0, "ALL", target, Set.of());
        assertThatThrownBy(() -> service.createConversation(UUID.randomUUID(), request))
                .isInstanceOf(com.chatapp.chat_service.common.exception.BadRequestException.class);
        verify(store, never()).claimDmPair(any(), any(), any());
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
    void memberDirectoryPagesByUserIdAndIncludesTheAuthoritativeChatPolicy() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID nextUserId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant mutedUntil = Instant.parse("2026-08-29T10:00:00Z");
        CanonicalConversationMember member = new CanonicalConversationMember(
                conversationId, userId, Set.of(), Instant.now(), actorId,
                mutedUntil, 45, "INHERIT", null, null);
        CanonicalConversationMember nextMember = member(conversationId, nextUserId);
        when(store.findConversationMember(conversationId, actorId)).thenReturn(member(conversationId, actorId));
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.listConversationMembers(conversationId, null, 2)).thenReturn(List.of(member, nextMember));
        when(users.findById(userId)).thenReturn(activeUser(userId));

        var members = service.listConversationMembers(actorId, conversationId, null, 1);

        assertThat(members.content()).singleElement().satisfies(view -> {
            assertThat(view.mutedUntil()).isEqualTo(mutedUntil);
            assertThat(view.messageIntervalSeconds()).isEqualTo(45);
        });
        assertThat(members.hasNext()).isTrue();
        assertThat(members.nextCursor()).isEqualTo(userId);
    }

    @Test
    void roomChatPolicyWritesCanonicalProjectionAndAuditState() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        CanonicalConversation before = conversationWithChatPolicy(conversationId, actorId, "OPEN", 0);
        when(store.findConversation(conversationId)).thenReturn(before);

        service.updateConversationChatPolicy(actorId, conversationId,
                new CanonicalApiContracts.ConversationChatPolicyRequest("READ_ONLY", 30));

        verify(store).updateConversationChatPolicy(eq(conversationId), eq("READ_ONLY"), eq(30), any(Instant.class));
        verify(adminConversationDirectory).updateChatPolicy(conversationId, "READ_ONLY", 30);
        verify(eventRecorder).record(
                actorId, conversationId, "CONVERSATION_CHAT_POLICY_UPDATE", "conversation",
                conversationId.toString(), null, null,
                Map.of("chatMode", "OPEN", "slowModeSeconds", "0"),
                Map.of("chatMode", "READ_ONLY", "slowModeSeconds", "30"));
    }

    @Test
    void memberChatPolicyRequiresReasonAndProtectsTheOwner() {
        UUID actorId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, ownerId, "ALL"));

        assertThatThrownBy(() -> service.updateMemberChatPolicy(
                actorId, conversationId, ownerId,
                new CanonicalApiContracts.MemberChatPolicyRequest(Instant.now(), 60, "moderation")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("owner");

        UUID memberId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateMemberChatPolicy(
                actorId, conversationId, memberId,
                new CanonicalApiContracts.MemberChatPolicyRequest(Instant.now(), 60, " ")))
                .isInstanceOf(com.chatapp.chat_service.common.exception.BadRequestException.class)
                .hasMessageContaining("reason");

        verify(store, never()).updateMemberChatPolicy(any(), any(), any(), any());
    }

    @Test
    void memberChatPolicyWritesTheExactBeforeAndAfterState() {
        UUID actorId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        Instant mutedUntil = Instant.now().plusSeconds(3600);
        CanonicalConversationMember member = new CanonicalConversationMember(
                conversationId, memberId, Set.of(), Instant.now(), ownerId,
                null, null, "INHERIT", null, null);
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, ownerId, "ALL"));
        when(store.findConversationMember(conversationId, memberId)).thenReturn(member);

        service.updateMemberChatPolicy(actorId, conversationId, memberId,
                new CanonicalApiContracts.MemberChatPolicyRequest(
                        mutedUntil, 120, " repeated advertising "));

        verify(store).updateMemberChatPolicy(conversationId, memberId, mutedUntil, 120);
        verify(eventRecorder).record(
                actorId, conversationId, "MEMBER_CHAT_POLICY_UPDATE", "conversation_member",
                memberId.toString(), memberId, "repeated advertising",
                Map.of("mutedUntil", "null", "messageIntervalSeconds", "null"),
                Map.of("mutedUntil", mutedUntil.toString(), "messageIntervalSeconds", "120"));
    }

    @Test
    void addMemberRejectsInactiveAccountsBeforeMutatingMembership() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(users.findById(invitedUserId)).thenReturn(new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser(
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
    void addMemberRejectsBannedUsersBeforeMutatingMembership() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(users.findById(invitedUserId)).thenReturn(activeUser(invitedUserId));
        when(entryPolicy.isBanned(conversationId, invitedUserId)).thenReturn(true);

        assertThatThrownBy(() -> service.addMember(
                actorId,
                conversationId,
                new CanonicalApiContracts.ConversationMemberRequest(invitedUserId, Set.of(), "invite")))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("banned");

        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void repeatedAddMemberRepairsProjectionWithoutDuplicatingAudit() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID invitedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, actorId, "ALL"));
        when(users.findById(invitedUserId)).thenReturn(activeUser(invitedUserId));
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
        when(users.findById(invitedUserId)).thenReturn(activeUser(invitedUserId));
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
        when(users.findById(invitedUserId)).thenReturn(activeUser(invitedUserId));
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
    void ownershipRacePreventsRemovingTheNewOwner() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID removedUserId = UUID.randomUUID();
        when(store.findConversation(conversationId))
                .thenReturn(conversation(conversationId, actorId, "ALL"));
        when(store.findConversationMember(conversationId, removedUserId))
                .thenReturn(member(conversationId, removedUserId));
        when(store.tryRemoveConversationMember(conversationId, removedUserId))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.OWNER_PROTECTED);

        assertThatThrownBy(() -> service.removeMember(actorId, conversationId, removedUserId))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("owner cannot be kicked");

        verify(eventRecorder, never()).record(
                eq(actorId), eq(conversationId), eq("MEMBER_REMOVE"), eq("conversation"),
                eq(conversationId.toString()), eq(removedUserId), any(), any(), any());
    }

    @Test
    void directInviteDoesNotConsumeAUseWhenTheConversationIsAlreadyFull() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(
                conversation(invite.conversationId(), UUID.randomUUID(), "ALL"));
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(
                        10, 10, UUID.randomUUID(), Instant.now(), 0L));

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("CAPACITY_REACHED");
        verify(inviteRepository, never()).consume(any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void directInviteCannotAddAMemberToAnArchivedConversation() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        Instant now = Instant.now();
        CanonicalConversation archived = new CanonicalConversation(
                invite.conversationId(), "GROUP", "PRIVATE", "INVITE_ONLY", "Archived", "archived",
                null, null, null, UUID.randomUUID(), UUID.randomUUID(), now, now,
                true, now, "OPEN", 0, null, "ALL", null, Set.of(), "vi", 10, 1, false, now);
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(archived);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("INACTIVE");
        verify(inviteRepository, never()).consume(any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void bannedUserCannotConsumeDirectInviteOrReserveAUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(entryPolicy.isBanned(invite.conversationId(), actorId)).thenReturn(true);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("BANNED");
        verify(inviteRepository, never()).consume(any(), any());
        verify(inviteRepository, never()).requestApproval(any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void concurrentBanRollsBackAJustClaimedInviteMembershipAndReleasesTheUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(
                conversation(invite.conversationId(), UUID.randomUUID(), "ALL"));
        when(store.requireMembershipState(invite.conversationId())).thenReturn(
                new CanonicalCqlStore.MembershipState(1, 10, UUID.randomUUID(), Instant.now(), 0L));
        when(inviteRepository.consume(invite.linkToken(), actorId))
                .thenReturn(InviteRepository.ConsumeResult.CONSUMED);
        when(store.tryAddConversationMember(any())).thenReturn(CanonicalCqlStore.MembershipMutationResult.ADDED);
        when(entryPolicy.isBanned(invite.conversationId(), actorId)).thenReturn(false, false, true);
        when(store.tryRemoveConversationMember(invite.conversationId(), actorId))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.REMOVED);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("BANNED");
        verify(store).tryRemoveConversationMember(invite.conversationId(), actorId);
        verify(inviteRepository).releaseUse(invite, actorId);
    }

    @Test
    void bannedUserCannotJoinOrRequestApprovalFromCommunityDiscovery() {
        UUID actorId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        when(store.findConversation(conversationId)).thenReturn(
                community(conversationId, false, "DIRECT_JOIN"));
        when(entryPolicy.isBanned(conversationId, actorId)).thenReturn(true);

        CanonicalApiContracts.CommunityJoinResponse response = communities.join(actorId, conversationId);

        assertThat(response.status()).isEqualTo("BANNED");
        verify(store, never()).requestCommunityApproval(any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void repeatedDirectInviteRepairsMembershipProjectionsWithoutConsumingAnotherUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        CanonicalConversationMember existingMember = member(invite.conversationId(), actorId);
        CanonicalConversation conversation = conversation(invite.conversationId(), UUID.randomUUID(), "ALL");
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversationMember(invite.conversationId(), actorId)).thenReturn(existingMember);
        when(store.findConversation(invite.conversationId())).thenReturn(conversation);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("ALREADY_MEMBER");
        verify(store).addConversationMembershipProjection(actorId, conversation, existingMember);
        verify(adminConversationDirectory).index(conversation);
        verify(inviteRepository, never()).consume(any(), any());
    }

    @Test
    void inviteApprovalStatusCanBeRestoredAfterPageReload() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(
                conversation(invite.conversationId(), UUID.randomUUID(), "ALL"));
        when(inviteRepository.findViewerStatus(invite, actorId)).thenReturn("PENDING");

        CanonicalApiContracts.InviteViewerState state = invites.viewerState(
                actorId, invite.linkToken());

        assertThat(state.status()).isEqualTo("PENDING");
        assertThat(state.conversationId()).isEqualTo(invite.conversationId());
    }

    @Test
    void incompleteDirectInviteAcceptanceIsExposedAsRetryable() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(
                conversation(invite.conversationId(), UUID.randomUUID(), "ALL"));
        when(inviteRepository.findViewerStatus(invite, actorId)).thenReturn("ACCEPTED");

        CanonicalApiContracts.InviteViewerState state = invites.viewerState(
                actorId, invite.linkToken());

        assertThat(state.status()).isEqualTo("FAILED");
        assertThat(state.conversationId()).isEqualTo(invite.conversationId());
    }

    @Test
    void communityDirectoryHydratesCanonicalStateAndMembershipWithoutReturningArchivedRooms() {
        UUID actorId = UUID.randomUUID();
        UUID joinedId = UUID.randomUUID();
        UUID archivedId = UUID.randomUUID();
        when(store.listCommunityDirectory(
                "language:vi:category:cong-nghe", "nova", null, null, 25))
                .thenReturn(List.of(
                        new CanonicalCqlStore.CommunityDirectoryKey("nova builders", joinedId),
                        new CanonicalCqlStore.CommunityDirectoryKey("nova old", archivedId)));
        CanonicalConversation joined = community(joinedId, false);
        when(store.findConversation(joinedId)).thenReturn(joined);
        when(store.findConversation(archivedId)).thenReturn(community(archivedId, true));
        when(store.findConversationMember(joinedId, actorId)).thenReturn(member(joinedId, actorId));

        CanonicalApiContracts.CommunityPage page = communities.list(
                actorId, "vi", "Công nghệ", null, "Nova", null, 24);

        assertThat(page.content()).singleElement().satisfies(item -> {
            assertThat(item.conversationId()).isEqualTo(joinedId);
            assertThat(item.membershipStatus()).isEqualTo("JOINED");
            assertThat(item.memberCount()).isEqualTo(1);
        });
        assertThat(page.hasNext()).isFalse();
    }

    @Test
    void communityDirectoryMapsInternalRequestStatesToThePublicContract() {
        UUID actorId = UUID.randomUUID();
        UUID approvingId = UUID.randomUUID();
        UUID declinedId = UUID.randomUUID();
        when(store.listCommunityDirectory("language:vi:all", "", null, null, 25))
                .thenReturn(List.of(
                        new CanonicalCqlStore.CommunityDirectoryKey("approving", approvingId),
                        new CanonicalCqlStore.CommunityDirectoryKey("declined", declinedId)));
        when(store.findConversation(approvingId)).thenReturn(community(approvingId, false));
        when(store.findConversation(declinedId)).thenReturn(community(declinedId, false));
        when(store.findCommunityJoinStatus(approvingId, actorId)).thenReturn("APPROVING");
        when(store.findCommunityJoinStatus(declinedId, actorId)).thenReturn("DECLINED");

        CanonicalApiContracts.CommunityPage page = communities.list(
                actorId, "vi", null, null, null, null, 24);

        assertThat(page.content()).extracting(CanonicalApiContracts.CommunitySummary::membershipStatus)
                .containsExactly("PENDING", "AVAILABLE");
    }

    @Test
    void communityCursorCannotBeReusedWithDifferentFilters() {
        UUID actorId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(store.listCommunityDirectory("language:vi:all", "nova", null, null, 2))
                .thenReturn(List.of(
                        new CanonicalCqlStore.CommunityDirectoryKey("nova alpha", firstId),
                        new CanonicalCqlStore.CommunityDirectoryKey("nova beta", secondId)));
        when(store.findConversation(firstId)).thenReturn(community(firstId, false));

        CanonicalApiContracts.CommunityPage firstPage = communities.list(
                actorId, "vi", null, null, "Nova", null, 1);

        assertThat(firstPage.nextCursor()).isNotBlank();
        assertThatThrownBy(() -> communities.list(
                actorId, "vi", null, null, "Other", firstPage.nextCursor(), 1))
                .isInstanceOf(com.chatapp.chat_service.common.exception.BadRequestException.class)
                .hasMessageContaining("does not match");
    }

    @Test
    void approvalCommunityJoinCreatesOnePendingRequestWithoutMutatingMembership() {
        UUID actorId = UUID.randomUUID();
        CanonicalConversation community = community(UUID.randomUUID(), false, "REQUEST_APPROVAL");
        when(store.findConversation(community.conversationId())).thenReturn(community);
        when(store.requestCommunityApproval(community.conversationId(), actorId))
                .thenReturn(new CanonicalCqlStore.CommunityJoinClaim("PENDING", true));

        CanonicalApiContracts.CommunityJoinResponse response = communities.join(
                actorId, community.conversationId());

        assertThat(response.status()).isEqualTo("PENDING");
        verify(store, never()).tryAddConversationMember(any());
        verify(eventRecorder).record(
                eq(actorId), eq(community.conversationId()), eq("COMMUNITY_JOIN_REQUEST"),
                eq("conversation"), eq(community.conversationId().toString()), eq(actorId),
                any(), any(), any());
    }

    @Test
    void directCommunityJoinClaimsMembershipAndRepairsEveryProjection() {
        UUID actorId = UUID.randomUUID();
        CanonicalConversation community = community(UUID.randomUUID(), false, "DIRECT_JOIN");
        when(store.findConversation(community.conversationId())).thenReturn(community);
        when(store.tryAddConversationMember(any()))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.ADDED);

        CanonicalApiContracts.CommunityJoinResponse response = communities.join(
                actorId, community.conversationId());

        assertThat(response.status()).isEqualTo("JOINED");
        verify(store).addConversationMembershipProjection(eq(actorId), eq(community), any());
        verify(adminConversationDirectory).index(community);
        verify(store).indexCommunityConversation(community);
    }

    @Test
    void roomManagerCanApproveACommunityRequestWithoutAnInviteLink() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        CanonicalCqlStore.CommunityJoinRequestRow requestRow =
                new CanonicalCqlStore.CommunityJoinRequestRow(
                        conversationId, userId, requestId, requestedAt,
                        "PENDING", null, null, null, null);
        when(store.findCommunityJoinRequest(conversationId, userId)).thenReturn(requestRow);
        when(store.claimCommunityJoinResolution(
                conversationId, userId, requestId, actorId, "APPROVE")).thenReturn(true);
        when(store.requireMembershipState(conversationId))
                .thenReturn(new CanonicalCqlStore.MembershipState(
                        1, 10, UUID.randomUUID(), Instant.now(), 0L));
        when(store.tryAddConversationMember(any())).thenReturn(CanonicalCqlStore.MembershipMutationResult.ADDED);
        when(store.findConversation(conversationId)).thenReturn(community(conversationId, false));

        joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(requestedAt, userId, "APPROVE", null));

        verify(store).finishCommunityJoinResolution(conversationId, userId, requestId, "APPROVED", actorId);
        verify(inviteRepository, never()).reserveUse(any(), any());
    }

    @Test
    void roomManagerCannotApproveACommunityRequestAfterTheUserIsBanned() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        when(store.findCommunityJoinRequest(conversationId, userId)).thenReturn(
                new CanonicalCqlStore.CommunityJoinRequestRow(
                        conversationId, userId, requestId, requestedAt, "PENDING", null, null, null, null));
        when(store.claimCommunityJoinResolution(
                conversationId, userId, requestId, actorId, "APPROVE")).thenReturn(true);
        when(entryPolicy.isBanned(conversationId, userId)).thenReturn(true);

        assertThatThrownBy(() -> joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(requestedAt, userId, "APPROVE", null)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class)
                .hasMessageContaining("banned");

        verify(store).finishCommunityJoinResolution(conversationId, userId, requestId, "FAILED", actorId);
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void roomManagerCanResumeItsInterruptedCommunityApproval() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        CanonicalCqlStore.CommunityJoinRequestRow claimedRequest =
                new CanonicalCqlStore.CommunityJoinRequestRow(
                        conversationId, userId, requestId, requestedAt,
                        "APPROVING", null, "APPROVE", actorId, Instant.now());
        when(store.findCommunityJoinRequest(conversationId, userId)).thenReturn(claimedRequest);
        when(store.claimCommunityJoinResolution(
                conversationId, userId, requestId, actorId, "APPROVE")).thenReturn(true);
        when(store.findConversationMember(conversationId, userId)).thenReturn(member(conversationId, userId));
        when(store.findConversation(conversationId)).thenReturn(community(conversationId, false));

        joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(requestedAt, userId, "APPROVE", null));

        verify(store).claimCommunityJoinResolution(
                conversationId, userId, requestId, actorId, "APPROVE");
        verify(store).finishCommunityJoinResolution(conversationId, userId, requestId, "APPROVED", actorId);
        verify(store).addConversationMembershipProjection(eq(userId), any(), any());
    }

    @Test
    void interruptedCommunityResolutionCannotResumeWithADifferentDecision() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        when(store.findCommunityJoinRequest(conversationId, userId)).thenReturn(
                new CanonicalCqlStore.CommunityJoinRequestRow(
                        conversationId, userId, requestId, requestedAt,
                        "APPROVING", null, "APPROVE", actorId, Instant.now()));

        assertThatThrownBy(() -> joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(
                        requestedAt, userId, "DECLINE", null)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);

        verify(store, never()).finishCommunityJoinResolution(any(), any(), any(), any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void roomManagerCanResumeItsInterruptedInviteApproval() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        CanonicalInviteLink invite = invite(conversationId);
        InviteRepository.InviteJoinRequest claimedRequest = new InviteRepository.InviteJoinRequest(
                "APPROVING", "APPROVE", actorId, userId, invite.linkId(), invite.linkToken(), Instant.now());
        when(inviteRepository.findRequest(conversationId, requestedAt, requestId)).thenReturn(claimedRequest);
        when(inviteRepository.claimResolution(
                conversationId, requestedAt, requestId, actorId, "APPROVE")).thenReturn(true);
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(inviteRepository.findViewerStatus(invite, userId)).thenReturn("ACCEPTED");
        when(store.findConversationMember(conversationId, userId)).thenReturn(member(conversationId, userId));
        when(store.findConversation(conversationId)).thenReturn(conversation(conversationId, UUID.randomUUID(), "ALL"));

        joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(
                        requestedAt, userId, "APPROVE", null));

        verify(inviteRepository).claimResolution(
                conversationId, requestedAt, requestId, actorId, "APPROVE");
        verify(inviteRepository).finishResolution(
                conversationId, requestedAt, requestId, "APPROVED", actorId);
        verify(store).addConversationMembershipProjection(eq(userId), any(), any());
    }

    @Test
    void interruptedInviteApprovalCannotResumeWithADifferentDecision() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID conversationId = UUID.randomUUID();
        UUID requestId = UUID.randomUUID();
        UUID requestedAt = UUID.randomUUID();
        InviteRepository.InviteJoinRequest claimedRequest = new InviteRepository.InviteJoinRequest(
                "APPROVING", "APPROVE", actorId, userId, null, null, Instant.now());
        when(inviteRepository.findRequest(conversationId, requestedAt, requestId)).thenReturn(claimedRequest);

        assertThatThrownBy(() -> joinRequests.resolve(
                actorId, conversationId, requestId,
                new CanonicalApiContracts.JoinRequestDecisionRequest(
                        requestedAt, userId, "DECLINE", null)))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);

        verify(inviteRepository, never()).finishResolution(any(), any(), any(), any(), any());
        verify(store, never()).tryAddConversationMember(any());
    }

    @Test
    void directInviteReleasesItsUseWhenCapacityIsReachedDuringTheMembershipClaim() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink invite = invite(UUID.randomUUID());
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(store.findConversation(invite.conversationId())).thenReturn(
                conversation(invite.conversationId(), UUID.randomUUID(), "ALL"));
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(
                        9, 10, UUID.randomUUID(), Instant.now(), 0L));
        when(inviteRepository.consume(invite.linkToken(), actorId))
                .thenReturn(InviteRepository.ConsumeResult.CONSUMED);
        when(store.tryAddConversationMember(any()))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("CAPACITY_REACHED");
        verify(inviteRepository).releaseUse(invite, actorId);
    }

    @Test
    void acceptedInviteReservationCompletesTheMissingMembershipWithoutAnotherUse() {
        UUID actorId = UUID.randomUUID();
        CanonicalInviteLink activeInvite = invite(UUID.randomUUID());
        CanonicalInviteLink invite = new CanonicalInviteLink(
                activeInvite.linkId(), activeInvite.linkToken(), activeInvite.conversationId(),
                activeInvite.createdBy(), activeInvite.createdAt(), activeInvite.inviteKind(),
                activeInvite.joinPolicy(), activeInvite.displayName(), activeInvite.expiresAt(),
                false, 10, 10, null, null);
        CanonicalConversation conversation = conversation(invite.conversationId(), UUID.randomUUID(), "ALL");
        when(inviteRepository.findByToken(invite.linkToken())).thenReturn(invite);
        when(inviteRepository.findViewerStatus(invite, actorId)).thenReturn("ACCEPTED");
        when(store.requireMembershipState(invite.conversationId()))
                .thenReturn(new CanonicalCqlStore.MembershipState(
                        1, 10, UUID.randomUUID(), Instant.now(), 0L));
        when(store.tryAddConversationMember(any()))
                .thenReturn(CanonicalCqlStore.MembershipMutationResult.ADDED);
        when(store.findConversation(invite.conversationId())).thenReturn(conversation);

        CanonicalApiContracts.InviteConsumeResponse response = invites.consume(
                actorId, new CanonicalApiContracts.InviteConsumeRequest(invite.linkToken()));

        assertThat(response.status()).isEqualTo("ACCEPTED");
        verify(inviteRepository, never()).releaseUse(any(), any());
        verify(inviteRepository, never()).consume(any(), any());
        verify(store).tryAddConversationMember(any());
        verify(store).addConversationMembershipProjection(eq(actorId), eq(conversation), any());
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

    private CanonicalConversation conversationWithChatPolicy(
            UUID conversationId,
            UUID ownerId,
            String chatMode,
            int slowModeSeconds) {
        Instant now = Instant.now();
        return new CanonicalConversation(
                conversationId, "GROUP", "PRIVATE", "INVITE_ONLY", "Room", "room", null, null, null,
                ownerId, ownerId, now, now, false, null, chatMode, slowModeSeconds, null, "ALL",
                null, Set.of(), "vi", 10, 1, false, now);
    }

    private CanonicalConversation community(UUID conversationId, boolean archived) {
        return community(conversationId, archived, "REQUEST_APPROVAL");
    }

    private CanonicalConversation community(UUID conversationId, boolean archived, String joinPolicy) {
        Instant now = Instant.now();
        return new CanonicalConversation(
                conversationId, "CHANNEL", "COMMUNITY", joinPolicy, "Nova Builders",
                "nova builders", "Cộng đồng sản phẩm", "https://example.com/community.png", null,
                UUID.randomUUID(), UUID.randomUUID(), now, now, archived, archived ? now : null,
                "OPEN", 0, null, "ALL", "cong-nghe", Set.of("product"), "vi",
                1000, 1, false, now);
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
