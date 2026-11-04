package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.Set;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ConversationBrowseServiceTest {
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final UserRepository users = mock(UserRepository.class);
    final MessageRepository messages = mock(MessageRepository.class);
    final ConversationBrowseService service = new ConversationBrowseService(store, users, messages);
    final UUID actor = UUID.randomUUID();
    final UUID roomId = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-20T08:00:00Z");

    @Test void requiresActorBeforeQuerying() {
        assertThatThrownBy(() -> service.list(null, null, 30, "", "ALL")).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(store);
    }

    @Test void previewReadsCurrentEditedAuthorityNotRetainedProjectionContent() {
        var result = currentPreview(false);
        assertThat(result.lastMessage().contentPreview()).isEqualTo("Current edited content");
        assertThat(new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper()
                .valueToTree(result.lastMessage()).path("revision").asInt(-1)).isEqualTo(7);
    }

    @Test void deletedAuthorityNeverExposesRetainedPreviewOrAttachmentAffordance() {
        var result = currentPreview(true);
        assertThat(result.lastMessage().contentPreview()).isEmpty();
        assertThat(result.lastMessage().deleted()).isTrue();
        assertThat(result.lastMessage().hasAttachments()).isFalse();
    }

    @Test void directoryUsesTheSameAuthorityAndOnlyOneExactMessageReadPerPreview() {
        currentPreview(false);
        var conversation = store.findConversation(roomId);
        var projection = store.findConversationProjectionAtActivity(actor, conversation);
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(projection), null, false));
        clearInvocations(messages);
        var result = service.list(actor, null, 30, "", "ALL");
        assertThat(result.content().get(0).lastMessage().revision()).isEqualTo(7);
        verify(messages).find(roomId, "2026-10-23-08:00", projection.lastMessage().messageId());
        verifyNoMoreInteractions(messages);
    }

    @Test void missingAuthorityFailsInsteadOfReturningPrivateStaleContent() {
        currentPreview(false);
        when(messages.find(any(), any(), any())).thenReturn(null);
        assertThatThrownBy(() -> service.get(actor, roomId)).isInstanceOf(ConflictException.class);
    }

    @Test void missingPreviewAuthorityKeepsTheDirectoryPageAndNeverReturnsRetainedContent() {
        var healthy = currentPreview(false);
        var healthyRow = store.findConversationProjectionAtActivity(actor, healthy.conversation());
        UUID unavailableRoomId = UUID.randomUUID(), unavailableMessageId = UUID.randomUUID();
        var unavailableRoom = mock(CanonicalConversation.class);
        when(unavailableRoom.conversationId()).thenReturn(unavailableRoomId);
        when(unavailableRoom.conversationType()).thenReturn("GROUP");
        when(store.findConversationMember(unavailableRoomId, actor)).thenReturn(
                new CanonicalConversationMember(unavailableRoomId, actor, Set.of(), now, null, null, null,
                        "INHERIT", null, null));
        var unavailablePreview = new CanonicalCqlStore.LastMessageProjection(unavailableMessageId, "2026-10-23-08:00",
                actor, "Sender", "Retained private text", "TEXT", now, false, true);
        var unavailableRow = new CanonicalCqlStore.ConversationProjectionRow(unavailableRoom, true, 2, now,
                "INHERIT", unavailablePreview, now);
        var next = new CanonicalCqlStore.ConversationProjectionCursor(false, now, roomId);
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(unavailableRow, healthyRow), next, true));
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of(unavailableRoomId));

        var page = service.list(actor, null, 30, "", "ALL");

        assertThat(page.content()).hasSize(2);
        var unavailable = page.content().get(0);
        assertThat(unavailable.conversation().conversationId()).isEqualTo(unavailableRoomId);
        assertThat(unavailable.lastMessage()).isNull();
        assertThat(unavailable.pinned()).isTrue();
        assertThat(unavailable.unreadCount()).isEqualTo(2);
        assertThat(page.content().get(1)).isEqualTo(healthy);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
        verify(messages).find(unavailableRoomId, unavailablePreview.messageBucket(), unavailableMessageId);
    }

    @Test void directoryDoesNotTurnStorageFailureIntoAMissingPreview() {
        var current = currentPreview(false);
        var row = store.findConversationProjectionAtActivity(actor, current.conversation());
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(row), null, false));
        var failure = new IllegalStateException("message storage unavailable");
        when(messages.find(roomId, row.lastMessage().messageBucket(), row.lastMessage().messageId())).thenThrow(failure);

        assertThatThrownBy(() -> service.list(actor, null, 30, "", "ALL")).isSameAs(failure);
    }

    @Test void authorityPreviewRetainsTheBounded280CharacterContract() {
        currentPreview(false);
        var projection = store.findConversationProjectionAtActivity(actor, store.findConversation(roomId));
        var message = messages.find(roomId, projection.lastMessage().messageBucket(), projection.lastMessage().messageId());
        when(message.content()).thenReturn("x".repeat(400));
        assertThat(service.get(actor, roomId).lastMessage().contentPreview()).isEqualTo("x".repeat(280));
    }

    private com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.ConversationListItem currentPreview(boolean deleted) {
        var base = row(false, 1);
        UUID messageId = UUID.randomUUID();
        var last = new CanonicalCqlStore.LastMessageProjection(messageId, "2026-10-23-08:00", actor, "Sender",
                "Stale retained projection", "TEXT", now, false, true);
        var projection = new CanonicalCqlStore.ConversationProjectionRow(base.conversation(), false, 1,
                now, "INHERIT", last, now);
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class));
        when(store.findConversation(roomId)).thenReturn(base.conversation());
        when(store.findConversationProjectionAtActivity(actor, base.conversation())).thenReturn(projection);
        var authority = mock(CanonicalMessage.class);
        when(authority.messageId()).thenReturn(messageId);
        when(authority.messageBucket()).thenReturn("2026-10-23-08:00");
        when(authority.senderId()).thenReturn(actor);
        when(authority.createdAt()).thenReturn(now);
        when(authority.messageType()).thenReturn("TEXT");
        when(authority.content()).thenReturn("Current edited content");
        when(authority.isDeleted()).thenReturn(deleted);
        when(authority.hasAttachments()).thenReturn(true);
        when(authority.revision()).thenReturn(7);
        when(messages.find(eq(roomId), any(), eq(messageId))).thenReturn(authority);
        return service.get(actor, roomId);
    }

    @Test void validatesInputBeforeQuerying() {
        assertThatThrownBy(() -> service.list(actor, null, 30, "x".repeat(101), "ALL")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(actor, null, 30, "", "FAVORITES")).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(actor, "bad", 30, "", "ALL")).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(store);
    }

    @Test void pointSummaryRequiresActorAndCurrentMembershipBeforeReadingPrivateData() {
        assertThatThrownBy(() -> service.get(null, roomId)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(store, users);
        assertThatThrownBy(() -> service.get(actor, roomId)).isInstanceOf(ForbiddenException.class);
        verify(store, never()).findConversation(any());
        verifyNoInteractions(users, messages);
    }

    @Test void pointAndListUseCurrentMembershipMetadataInsteadOfStaleDirectoryValues() {
        var row = row(true, 7);
        Instant joinedAt = now.plusSeconds(1);
        var member = new CanonicalConversationMember(roomId, actor, Set.of(), joinedAt,
                null, null, null, "NONE", null, null);
        when(store.findConversationMember(roomId, actor)).thenReturn(member);
        when(store.findConversation(roomId)).thenReturn(row.conversation());
        when(store.findConversationProjectionAtActivity(actor, row.conversation())).thenReturn(row);
        var result = service.get(actor, roomId);
        assertThat(result.pinned()).isTrue();
        assertThat(result.unreadCount()).isEqualTo(7);
        assertThat(result.notificationOverride()).isEqualTo("NONE");
        assertThat(result.joinedAt()).isEqualTo(joinedAt);
        verify(store, never()).scanConversationProjectionByUser(any(), any(), anyInt());

        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(row), null, false));
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of(roomId));
        assertThat(service.list(actor, null, 30, "", "ALL").content()).containsExactly(result);
    }

    @Test void pointSummaryDistinguishesMissingRoomFromLaggingProjectionWithoutDefaults() {
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class));
        assertThatThrownBy(() -> service.get(actor, roomId)).isInstanceOf(NotFoundException.class);
        when(store.findConversation(roomId)).thenReturn(row(false, 0).conversation());
        assertThatThrownBy(() -> service.get(actor, roomId)).isInstanceOf(ConflictException.class);
        verify(store, times(3)).findConversationProjectionAtActivity(eq(actor), any());
    }

    @Test void pointSummaryRechecksMembershipAfterProjectionRead() {
        var row = row(false, 1);
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class), null);
        when(store.findConversation(roomId)).thenReturn(row.conversation());
        when(store.findConversationProjectionAtActivity(actor, row.conversation())).thenReturn(row);
        assertThatThrownBy(() -> service.get(actor, roomId)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(users);
    }

    @Test void pointSummaryRetriesMovingActivityButNeverReadsTheWholeDirectory() {
        var stable = row(true, 7);
        var moving = new CanonicalCqlStore.ConversationProjectionRow(stable.conversation(), false, 0,
                now, "INHERIT", null, now.minusSeconds(1));
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class));
        when(store.findConversation(roomId)).thenReturn(stable.conversation());
        when(store.findConversationProjectionAtActivity(actor, stable.conversation())).thenReturn(moving, stable);
        assertThat(service.get(actor, roomId).unreadCount()).isEqualTo(7);
        verify(store, times(2)).findConversationProjectionAtActivity(actor, stable.conversation());
        verify(store, never()).scanConversationProjectionByUser(any(), any(), anyInt());
    }

    @Test void continuationUsesScannedRowEvenWhenNoResultMatches() {
        var cursor = new CanonicalCqlStore.ConversationProjectionCursor(false, now, roomId);
        when(store.scanConversationProjectionByUser(actor, null, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(List.of(row(false, 0)), cursor, true));
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class));
        var first = service.list(actor, null, 30, "another", "UNREAD");
        assertThat(first.content()).isEmpty();
        assertThat(first.hasNext()).isTrue();
        when(store.scanConversationProjectionByUser(actor, cursor, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(List.of(), null, false));
        assertThat(service.list(actor, first.nextCursor(), 30, "another", "UNREAD").hasNext()).isFalse();
        verify(store).scanConversationProjectionByUser(actor, cursor, 30);
        assertThatThrownBy(() -> service.list(actor, first.nextCursor(), 30, "changed", "UNREAD"))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(UUID.randomUUID(), first.nextCursor(), 30, "another", "UNREAD"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test void appliesFilterAndAccentInsensitiveNameTogether() {
        when(store.scanConversationProjectionByUser(actor, null, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(List.of(row(true, 2)), null, false));
        when(store.findConversationMember(roomId, actor)).thenReturn(mock(CanonicalConversationMember.class));
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of(roomId));
        assertThat(service.list(actor, null, 30, "noi", "PINNED").content()).hasSize(1);
        assertThat(service.list(actor, null, 30, "missing", "UNREAD").content()).isEmpty();
    }

    @Test void directoryUsesOnePinSnapshotForFlagsAndFilterButKeepsTheRawCursor() {
        var stalePinned = row(true, 0);
        UUID pinnedRoomId = UUID.randomUUID();
        var pinnedRoom = mock(CanonicalConversation.class);
        when(pinnedRoom.conversationId()).thenReturn(pinnedRoomId);
        when(pinnedRoom.conversationType()).thenReturn("GROUP");
        var staleUnpinned = new CanonicalCqlStore.ConversationProjectionRow(pinnedRoom, false, 0, now,
                "INHERIT", null, now);
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of(pinnedRoomId));
        var member = mock(CanonicalConversationMember.class);
        when(store.findConversationMember(roomId, actor)).thenReturn(member);
        when(store.findConversationMember(pinnedRoomId, actor)).thenReturn(member);
        var cursor = new CanonicalCqlStore.ConversationProjectionCursor(false, now, pinnedRoomId);
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(stalePinned, staleUnpinned), cursor, true));
        when(store.scanConversationProjectionByUser(actor, cursor, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(), null, false));

        var all = service.list(actor, null, 30, "", "ALL");
        assertThat(all.content()).extracting(item -> item.pinned()).containsExactly(false, true);
        verify(store).findPinnedConversationIds(actor);

        var filtered = service.list(actor, null, 30, "", "PINNED");
        assertThat(filtered.content()).extracting(item -> item.conversation().conversationId()).containsExactly(pinnedRoomId);
        assertThat(filtered.hasNext()).isTrue();
        assertThat(service.list(actor, filtered.nextCursor(), 30, "", "PINNED").content()).isEmpty();
        verify(store).scanConversationProjectionByUser(actor, cursor, 30);
        verify(store, times(2)).findPinnedConversationIds(actor);
    }

    @Test void directoryCollapsesDuplicateRowsBeforeHydrationAndPreservesRawPageOrder() {
        var matchingPin = row(true, 3);
        var room = matchingPin.conversation();
        var staleActivity = new CanonicalCqlStore.ConversationProjectionRow(room, true, 20, now,
                "INHERIT", null, now.minusSeconds(1));
        var mismatchedPin = new CanonicalCqlStore.ConversationProjectionRow(room, false, 5, now,
                "INHERIT", null, now);
        UUID otherRoomId = UUID.randomUUID();
        var otherRoom = mock(CanonicalConversation.class);
        when(otherRoom.conversationId()).thenReturn(otherRoomId);
        when(otherRoom.conversationType()).thenReturn("GROUP");
        var other = new CanonicalCqlStore.ConversationProjectionRow(otherRoom, false, 0, now, "INHERIT", null, now);
        var member = mock(CanonicalConversationMember.class);
        when(store.findConversationMember(roomId, actor)).thenReturn(member);
        when(store.findConversationMember(otherRoomId, actor)).thenReturn(member);
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of(roomId));
        var cursor = new CanonicalCqlStore.ConversationProjectionCursor(false, now, roomId);
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(staleActivity, other, mismatchedPin), cursor, true),
                new CanonicalCqlStore.ConversationProjectionPage(List.of(staleActivity, other, mismatchedPin, matchingPin), cursor, true));

        var moving = service.list(actor, null, 30, "", "ALL");
        assertThat(moving.content()).extracting(item -> item.conversation().conversationId()).containsExactly(roomId, otherRoomId);
        assertThat(moving.content().get(0).unreadCount()).isEqualTo(5);

        var repaired = service.list(actor, null, 30, "", "ALL");
        assertThat(repaired.content()).extracting(item -> item.conversation().conversationId()).containsExactly(roomId, otherRoomId);
        assertThat(repaired.content().get(0).unreadCount()).isEqualTo(3);
        assertThat(repaired.nextCursor()).isNotBlank().isEqualTo(moving.nextCursor());
        verify(store, times(2)).findConversationMember(roomId, actor);
    }

    @Test void staleProjectionDoesNotExposeRoomAfterMembershipLoss() {
        when(store.scanConversationProjectionByUser(actor, null, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(List.of(row(true, 2)), null, false));
        assertThat(service.list(actor, null, 30, "", "ALL").content()).isEmpty();
    }

    @Test void directoryBoundsRepairWorkAndKeepsAllObservedRooms() {
        var rows = java.util.stream.IntStream.range(0, 5).mapToObj(index -> {
            var conversation = mock(CanonicalConversation.class);
            when(conversation.conversationId()).thenReturn(UUID.randomUUID());
            when(conversation.conversationType()).thenReturn("GROUP");
            when(conversation.lastActivityAt()).thenReturn(now);
            return new CanonicalCqlStore.ConversationProjectionRow(conversation, true, 0, now, "INHERIT", null, now);
        }).toList();
        var member = mock(CanonicalConversationMember.class);
        when(store.findConversationMember(any(), eq(actor))).thenReturn(member);
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of());
        when(store.scanConversationProjectionByUser(actor, null, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(rows, null, false));

        var result = service.list(actor, null, 30, "", "ALL");
        assertThat(result.content()).hasSize(5).allMatch(item -> !item.pinned());
        for (var row : rows.subList(0, 3)) verify(store).repairConversationProjectionPin(actor, row, false);
        verify(store, times(3)).repairConversationProjectionPin(eq(actor), any(), eq(false));
    }

    @Test void staleActivityRepairsShareThePinBudgetAndKeepTheRawCursor() {
        var currentPinMismatch = row(true, 0);
        var lateRows = java.util.stream.IntStream.range(0, 4).mapToObj(index -> {
            var conversation = mock(CanonicalConversation.class);
            when(conversation.conversationId()).thenReturn(UUID.randomUUID());
            when(conversation.lastActivityAt()).thenReturn(now);
            var preview = new CanonicalCqlStore.LastMessageProjection(com.datastax.oss.driver.api.core.uuid.Uuids.startOf(now.toEpochMilli()),
                    "2026-10-20-08:00", actor, "Sender", "", "TEXT", now, false, false);
            return new CanonicalCqlStore.ConversationProjectionRow(conversation, false, 0, now,
                    "INHERIT", preview, now.minusSeconds(index + 1L));
        }).toList();
        var rows = new java.util.ArrayList<>(lateRows);
        rows.add(currentPinMismatch);
        var lastRawRow = lateRows.get(lateRows.size() - 1);
        var rawCursor = new CanonicalCqlStore.ConversationProjectionCursor(false, lastRawRow.lastActivityAt(),
                lastRawRow.conversation().conversationId());
        when(store.findPinnedConversationIds(actor)).thenReturn(Set.of());
        when(store.scanConversationProjectionByUser(actor, null, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(rows, rawCursor, true));
        when(store.scanConversationProjectionByUser(actor, rawCursor, 30)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionPage(List.of(), null, false));

        var page = service.list(actor, null, 30, "", "ALL");
        assertThat(page.hasNext()).isTrue();
        verify(store).repairConversationProjectionPin(actor, currentPinMismatch, false);
        verify(store).repairConversationProjectionActivity(actor, lateRows.get(0), false);
        verify(store).repairConversationProjectionActivity(actor, lateRows.get(1), false);
        verify(store, times(2)).repairConversationProjectionActivity(eq(actor), any(), eq(false));
        service.list(actor, page.nextCursor(), 30, "", "ALL");
        verify(store).scanConversationProjectionByUser(actor, rawCursor, 30);
    }

    @Test void searchesCurrentDmPeerAndReturnsOnlyPublicSummaryFields() {
        UUID peerId = UUID.randomUUID();
        var room = new CanonicalConversation(roomId, "DM", "PRIVATE", "INVITE_ONLY", "DM", "dm",
                null, null, null, actor, actor, now, now, false, null, "OPEN", 0, null, "ALL", null,
                Set.of(), "vi", 2, 2, false, now);
        var projection = new CanonicalCqlStore.ConversationProjectionRow(room, false, 0, now, "INHERIT", null, now);
        when(store.scanConversationProjectionByUser(actor, null, 30))
                .thenReturn(new CanonicalCqlStore.ConversationProjectionPage(List.of(projection), null, false));
        var member = new CanonicalConversationMember(roomId, actor, Set.of(), now, null, null, null, "INHERIT", null, null);
        var peer = new CanonicalConversationMember(roomId, peerId, Set.of(), now, null, null, null, "INHERIT", null, null);
        when(store.findConversationMember(roomId, actor)).thenReturn(member);
        when(store.listConversationMembers(roomId, null, 3)).thenReturn(List.of(member, peer));
        when(users.findById(peerId)).thenReturn(new CanonicalUser(peerId, "linh", "linh", "private@example.com",
                "private@example.com", "private-hash", "LOCAL", null, "Đỗ Linh", null, "ACTIVE", now, now, null));
        var result = service.list(actor, null, 30, "do linh", "ALL");
        assertThat(result.content()).hasSize(1);
        assertThat(result.content().get(0).peer().displayName()).isEqualTo("Đỗ Linh");
        assertThat(result.content().get(0).peer().toString()).doesNotContain("private@example.com", "private-hash");
        when(store.findConversation(roomId)).thenReturn(room);
        when(store.findConversationProjectionAtActivity(actor, room)).thenReturn(projection);
        assertThat(service.get(actor, roomId)).isEqualTo(result.content().get(0));
    }

    private CanonicalCqlStore.ConversationProjectionRow row(boolean pinned, int unread) {
        var room = new CanonicalConversation(roomId, "GROUP", "PRIVATE", "INVITE_ONLY", "Nối cộng đồng",
                "noi cong dong", null, null, null, actor, actor, now, now, false, null, "OPEN", 0,
                null, "ALL", null, Set.of(), "vi", 100, 2, false, now);
        return new CanonicalCqlStore.ConversationProjectionRow(room, pinned, unread, now, "INHERIT", null, now);
    }
}
