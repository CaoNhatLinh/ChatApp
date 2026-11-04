package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageReplyPolicyTest {
    final MessageRepository messages = mock(MessageRepository.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final MessageReplyPolicy policy = new MessageReplyPolicy(messages, friendships);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), parentId = Uuids.timeBased();
    final String bucket = "2026-10-20-08:00";

    MessageSendRequest request(UUID id, String sourceBucket) {
        return new MessageSendRequest(UUID.randomUUID(), "TEXT", "reply", "PLAIN", id, sourceBucket,
                null, null, null, null, null, List.of(), Set.of(), false, null);
    }

    @Test void noReplyDoesNotProbeHistory() {
        MessageReplyPolicy.validateShape(request(null, null));
        assertThat(policy.resolve(actor, room, request(null, null))).isNull();
        verifyNoInteractions(messages, friendships);
    }

    @Test void partialMalformedOrNonCanonicalParentKeysAreRejected() {
        for (var request : List.of(request(parentId, null), request(null, bucket), request(UUID.randomUUID(), bucket),
                request(parentId, "2026-99-20-08:00"), request(parentId, "2026-10-20-08:16"))) {
            assertThatThrownBy(() -> MessageReplyPolicy.validateShape(request)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(messages);
    }

    @Test void resolvesTheExactCurrentRoomBucketAndActualSender() {
        UUID sender = UUID.randomUUID();
        var parent = mock(CanonicalMessage.class);
        when(parent.senderId()).thenReturn(sender);
        when(messages.find(room, bucket, parentId)).thenReturn(parent);
        assertThat(policy.resolve(actor, room, request(parentId, bucket))).isSameAs(parent);
        verify(messages).find(room, bucket, parentId);
        verify(friendships).isBlocked(actor, sender);
    }

    @Test void missingDeletedOrBlockedSourceStaysUnavailable() {
        assertThatThrownBy(() -> policy.resolve(actor, room, request(parentId, bucket))).isInstanceOf(NotFoundException.class);
        var parent = mock(CanonicalMessage.class);
        when(messages.find(room, bucket, parentId)).thenReturn(parent);
        when(parent.isDeleted()).thenReturn(true);
        assertThatThrownBy(() -> policy.resolve(actor, room, request(parentId, bucket))).isInstanceOf(NotFoundException.class);
        when(parent.isDeleted()).thenReturn(false);
        UUID sender = UUID.randomUUID(); when(parent.senderId()).thenReturn(sender);
        when(friendships.isBlocked(actor, sender)).thenReturn(true);
        assertThatThrownBy(() -> policy.resolve(actor, room, request(parentId, bucket))).isInstanceOf(NotFoundException.class);
    }
}
