package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageThreadServiceTest {
    final MessageRepository messages = mock(MessageRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final MessageThreadService threads = new MessageThreadService(authorization, messages, friendships);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), parentId = Uuids.timeBased(), peer = UUID.randomUUID();
    final String bucket = "2026-10-20-08:03";
    final Instant now = Instant.parse("2026-10-20T09:00:00.123Z");
    MessageThreadServiceTest() { when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(0, List.of())); }

    CanonicalMessage message(UUID id, UUID sender, UUID parent, boolean deleted) {
        return new CanonicalMessage(room, bucket, id, sender, "TEXT", "authority content", "PLAIN", parent, peer,
                null, null, null, null, null, null, deleted, null, null, null, false, false, false,
                now, UUID.randomUUID(), null, parent == null ? null : bucket, 0);
    }
    void parent() { when(messages.find(room, bucket, parentId)).thenReturn(message(parentId, peer, null, false)); }
    @Test void parentAndRepliesShareOneAuthoritativePinRead() {
        parent(); UUID child = Uuids.timeBased();
        when(messages.findReplies(room, bucket, parentId, null, 26)).thenReturn(List.of(ref(child)));
        when(messages.find(room, bucket, child)).thenReturn(message(child, peer, parentId, false));
        when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(7, List.of(
                new MessageRepository.PinSlot((byte) 0, bucket, parentId, Uuids.timeBased()),
                new MessageRepository.PinSlot((byte) 1, bucket, child, Uuids.timeBased()))));
        var page = threads.list(actor, room, bucket, parentId, 25, null);
        assertThat(page.parent().isPinned()).isTrue();
        assertThat(page.content().get(0).isPinned()).isTrue();
        verify(messages).findPinState(room);
    }
    MessageRepository.ReplyReference ref(UUID id) { return new MessageRepository.ReplyReference(Uuids.startOf(now.toEpochMilli()), id, bucket); }

    @Test void forbiddenRequestCannotProbeParentOrDecodeCursor() {
        doThrow(new ForbiddenException("not member")).when(authorization).requireMember(room, actor);
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 25, "bad"))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(messages, friendships);
    }

    @Test void invalidKeysLimitsOrCursorFailBeforeMessageQueries() {
        assertThatThrownBy(() -> threads.list(actor, room, bucket, UUID.randomUUID(), 25, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> threads.list(actor, room, "2026-02-30-08:00", parentId, 25, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 0, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 51, null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 25, "bad")).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(messages);
    }

    @Test void missingOrBlockedParentDoesNotRevealReplies() {
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 25, null)).isInstanceOf(NotFoundException.class);
        parent(); when(friendships.isBlocked(actor, peer)).thenReturn(true);
        assertThatThrownBy(() -> threads.list(actor, room, bucket, parentId, 25, null)).isInstanceOf(NotFoundException.class);
        verify(messages, never()).findReplies(any(), any(), any(), any(), anyInt());
    }

    @Test void completeCursorKeepsSameMillisecondTieAndIsScopedToActorRoomParent() {
        parent(); UUID first = Uuids.timeBased(), second = Uuids.timeBased();
        var firstRef = ref(first);
        when(messages.findReplies(room, bucket, parentId, null, 2)).thenReturn(List.of(firstRef, ref(second)));
        when(messages.find(room, bucket, first)).thenReturn(message(first, peer, parentId, false));
        var page = threads.list(actor, room, bucket, parentId, 1, null);
        assertThat(page.content()).extracting(CanonicalMessage::messageId).containsExactly(first);
        assertThat(page.hasNext()).isTrue(); assertThat(page.nextCursor()).isNotBlank();
        var position = new MessageRepository.ReplyPosition(firstRef.createdAt(), first);
        when(messages.findReplies(room, bucket, parentId, position, 2)).thenReturn(List.of(ref(second)));
        when(messages.find(room, bucket, second)).thenReturn(message(second, peer, parentId, false));
        var next = threads.list(actor, room, bucket, parentId, 1, page.nextCursor());
        assertThat(next.content()).extracting(CanonicalMessage::messageId).containsExactly(second);
        assertThat(next.hasNext()).isFalse(); assertThat(next.nextCursor()).isNull();
        for (Runnable changedScope : List.<Runnable>of(
                () -> threads.list(UUID.randomUUID(), room, bucket, parentId, 1, page.nextCursor()),
                () -> threads.list(actor, UUID.randomUUID(), bucket, parentId, 1, page.nextCursor()),
                () -> threads.list(actor, room, "2026-10-20-08:04", parentId, 1, page.nextCursor()),
                () -> threads.list(actor, room, bucket, Uuids.timeBased(), 1, page.nextCursor()))) {
            assertThatThrownBy(changedScope::run).isInstanceOf(BadRequestException.class);
        }
    }

    @Test void filteredPageAdvancesOverMissingBlockedAndWrongParentWithoutScanningAhead() {
        parent(); UUID missing = Uuids.timeBased(), blocked = Uuids.timeBased(), wrong = Uuids.timeBased(), remaining = Uuids.timeBased();
        UUID blockedSender = UUID.randomUUID();
        when(messages.findReplies(room, bucket, parentId, null, 4)).thenReturn(List.of(ref(missing), ref(blocked), ref(wrong), ref(remaining)));
        when(messages.find(room, bucket, blocked)).thenReturn(message(blocked, blockedSender, parentId, false));
        when(friendships.isBlocked(actor, blockedSender)).thenReturn(true);
        when(messages.find(room, bucket, wrong)).thenReturn(message(wrong, peer, Uuids.timeBased(), false));
        var page = threads.list(actor, room, bucket, parentId, 3, null);
        assertThat(page.content()).isEmpty(); assertThat(page.hasNext()).isTrue();
        verify(messages, never()).find(room, bucket, remaining);
        threads.list(actor, room, bucket, parentId, 3, page.nextCursor());
        verify(messages).findReplies(room, bucket, parentId, new MessageRepository.ReplyPosition(ref(wrong).createdAt(), wrong), 4);
    }

    @Test void deletedParentAndChildArePublicTombstonesNotInvestigationContent() {
        when(messages.find(room, bucket, parentId)).thenReturn(message(parentId, peer, null, true));
        UUID child = Uuids.timeBased();
        when(messages.findReplies(room, bucket, parentId, null, 26)).thenReturn(List.of(ref(child)));
        when(messages.find(room, bucket, child)).thenReturn(message(child, peer, parentId, true));
        var page = threads.list(actor, room, bucket, parentId, 25, null);
        assertThat(page.parent().content()).isEmpty(); assertThat(page.parent().isDeleted()).isTrue();
        assertThat(page.content().get(0).content()).isEmpty();
        assertThat(page.content().get(0).replyToMessageBucket()).isNull();
    }
}
