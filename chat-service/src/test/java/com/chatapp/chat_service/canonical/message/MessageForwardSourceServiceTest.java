package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageForwardSourceServiceTest {
    final MessageRepository messages = mock(MessageRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final MessageForwardSourceService service = new MessageForwardSourceService(messages, authorization, friendships);
    final UUID actor = UUID.randomUUID(), target = UUID.randomUUID(), sourceRoom = UUID.randomUUID();
    final String bucket = "2026-10-20-08:03";
    final CanonicalMessage source = message(sourceRoom, null, null, false);
    final CanonicalMessage copy = message(target, sourceRoom, source.messageId(), false);

    MessageForwardSourceServiceTest() {
        when(messages.findPinState(sourceRoom)).thenReturn(new MessageRepository.PinState(0, java.util.List.of()));
    }

    @Test void eachPointReadChecksBothMembershipsAndReturnsOnlyImmediateSource() {
        when(messages.find(target, bucket, copy.messageId())).thenReturn(copy);
        when(messages.find(sourceRoom, bucket, source.messageId())).thenReturn(source);
        when(messages.findPinState(sourceRoom)).thenReturn(new MessageRepository.PinState(1, java.util.List.of(
                new MessageRepository.PinSlot((byte) 0, bucket, source.messageId(), Uuids.timeBased()))));
        var view = service.get(actor, target, bucket, copy.messageId());
        assertThat(view.source().messageId()).isEqualTo(source.messageId());
        assertThat(view.source().isPinned()).isTrue();
        assertThat(service.get(actor, target, bucket, copy.messageId()).available()).isTrue();
        verify(authorization, times(2)).requireMember(target, actor);
        verify(authorization, times(2)).requireMember(sourceRoom, actor);
        verify(messages, times(2)).findPinState(sourceRoom);
    }

    @Test void destinationMembershipPrecedesAnyLookup() {
        doThrow(new ForbiddenException("not member")).when(authorization).requireMember(target, actor);
        assertThatThrownBy(() -> service.get(actor, target, bucket, copy.messageId())).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(messages, friendships);
    }

    @Test void revokedSourceHasNoPrivateKeysOrContentAndDoesNotReadSource() {
        when(messages.find(target, bucket, copy.messageId())).thenReturn(copy);
        doThrow(new ForbiddenException("revoked")).when(authorization).requireMember(sourceRoom, actor);
        var view = service.get(actor, target, bucket, copy.messageId());
        assertThat(view.available()).isFalse(); assertThat(view.source()).isNull();
        verify(messages, never()).find(sourceRoom, bucket, source.messageId());
    }

    @Test void missingDeletedBlockedSourcesHaveSameUnavailableShape() {
        when(messages.find(target, bucket, copy.messageId())).thenReturn(copy);
        assertThat(service.get(actor, target, bucket, copy.messageId()).available()).isFalse();
        when(messages.find(sourceRoom, bucket, source.messageId())).thenReturn(message(sourceRoom, null, null, true));
        assertThat(service.get(actor, target, bucket, copy.messageId()).source()).isNull();
        when(messages.find(sourceRoom, bucket, source.messageId())).thenReturn(source);
        when(friendships.isBlocked(actor, source.senderId())).thenReturn(true);
        assertThat(service.get(actor, target, bucket, copy.messageId()).source()).isNull();
    }

    CanonicalMessage message(UUID room, UUID fromRoom, UUID fromId, boolean deleted) {
        return new CanonicalMessage(room, bucket, Uuids.timeBased(), UUID.randomUUID(), "TEXT", "snapshot", "PLAIN",
                null, null, null, null, null, fromRoom, fromRoom == null ? null : bucket, fromId, deleted, null,
                null, null, false, false, false, Instant.now(), UUID.randomUUID(), null, null, 0);
    }
}
