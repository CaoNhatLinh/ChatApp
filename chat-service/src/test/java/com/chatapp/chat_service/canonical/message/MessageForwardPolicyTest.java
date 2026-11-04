package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageForwardPolicyTest {
    final MessageRepository messages = mock(MessageRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final MessageForwardPolicy policy = new MessageForwardPolicy(messages, authorization, friendships);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
    final String bucket = "2026-10-20-08:03";

    @Test void exactSnapshotResolvesOnlyAfterSourceMembership() {
        var source = source(false, "original"); when(messages.find(room, bucket, id)).thenReturn(source);
        assertThat(policy.resolve(actor, request("original", room, bucket, id))).isSameAs(source);
        var order = inOrder(authorization, messages);
        order.verify(authorization).requireMember(room, actor); order.verify(messages).find(room, bucket, id);
    }

    @Test void partialAndMalformedKeysFailBeforeLookup() {
        for (var request : List.of(request("original", null, bucket, id), request("original", room, null, id),
                request("original", room, bucket, UUID.randomUUID()), request("original", room, "2026-02-30-08:03", id))) {
            assertThatThrownBy(() -> MessageForwardPolicy.validateShape(request)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(messages, authorization);
    }

    @Test void ordinarySendHasNoSourceLookup() {
        var request = request("normal", null, null, null);
        MessageForwardPolicy.validateShape(request);
        assertThat(policy.resolve(actor, request)).isNull(); verifyNoInteractions(messages, authorization, friendships);
    }

    @Test void prepareReadsAnAuthorizedSnapshotWithoutAllocatingACommand() {
        var source = source(false, "original"); when(messages.find(room, bucket, id)).thenReturn(source);
        var draft = policy.prepare(actor, room, bucket, id);
        assertThat(draft.message()).isSameAs(source); assertThat(draft.attachments()).isEmpty();
        verify(authorization).requireMember(room, actor);
        verify(messages, never()).claim(any(), any(), any(), any(), any(), any());
    }

    @Test void prepareMissingOrDeletedSourceIsUnavailable() {
        assertThatThrownBy(() -> policy.prepare(actor, room, bucket, id)).isInstanceOf(NotFoundException.class);
        when(messages.find(room, bucket, id)).thenReturn(source(true, "retained"));
        assertThatThrownBy(() -> policy.prepare(actor, room, bucket, id)).isInstanceOf(NotFoundException.class);
    }

    @Test void forwardingCannotInventPollCopyOrTriggerReplyAndMentionSemantics() {
        for (var request : List.of(
                new MessageSendRequest(UUID.randomUUID(), "POLL", "original", "PLAIN", null, null, null, UUID.randomUUID(),
                        room, bucket, id, List.of(), Set.of(), false, null),
                new MessageSendRequest(UUID.randomUUID(), "TEXT", "original", "PLAIN", id, bucket, null, null,
                        room, bucket, id, List.of(), Set.of(), false, null),
                new MessageSendRequest(UUID.randomUUID(), "TEXT", "original", "PLAIN", null, null, null, null,
                        room, bucket, id, List.of(), Set.of(actor), true, null))) {
            assertThatThrownBy(() -> MessageForwardPolicy.validateShape(request)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(messages, authorization, friendships);
    }

    @Test void outsiderDoesNotLearnWhetherSourceExists() {
        doThrow(new ForbiddenException("membership")).when(authorization).requireMember(room, actor);
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id)))
                .isInstanceOf(NotFoundException.class).hasMessage("forward source is unavailable");
        verifyNoInteractions(messages);
    }

    @Test void missingDeletedAndBlockedAreUnavailable() {
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id))).isInstanceOf(NotFoundException.class);
        when(messages.find(room, bucket, id)).thenReturn(source(true, "original"));
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id))).isInstanceOf(NotFoundException.class);
        var source = source(false, "original"); when(messages.find(room, bucket, id)).thenReturn(source);
        when(friendships.isBlocked(actor, source.senderId())).thenReturn(true);
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id))).isInstanceOf(NotFoundException.class);
    }

    @Test void spoofedOrChangedSnapshotConflictsRatherThanChangingRetryPayload() {
        when(messages.find(room, bucket, id)).thenReturn(source(false, "edited source"));
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id)))
                .isInstanceOf(ConflictException.class);
    }

    @Test void attachmentsMustMatchBoundedSourceAuthority() {
        var source = mock(CanonicalMessage.class);
        when(source.conversationId()).thenReturn(room); when(source.messageBucket()).thenReturn(bucket);
        when(source.messageId()).thenReturn(id); when(source.content()).thenReturn("original");
        when(source.messageType()).thenReturn("TEXT"); when(source.contentFormat()).thenReturn("PLAIN");
        when(source.senderId()).thenReturn(actor); when(source.hasAttachments()).thenReturn(true);
        when(messages.find(room, bucket, id)).thenReturn(source);
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id)))
                .isInstanceOf(ConflictException.class);
        var actual = new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAttachment(UUID.randomUUID(),
                UUID.randomUUID(), "CLOUDINARY", "key", "image.png", "image/png", 10L, null, null, null, null, false);
        when(messages.findAttachments(room, bucket, id, null, 51)).thenReturn(List.of(actual));
        assertThat(policy.prepare(actor, room, bucket, id).attachments()).containsExactly(actual);
        var valid = new com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest(UUID.randomUUID(), actual.assetId(),
                "CLOUDINARY", "key", "image.png", "image/png", 10L, null, null, null, null, false);
        var request = new MessageSendRequest(UUID.randomUUID(), "TEXT", "original", "PLAIN", null, null, null, null,
                room, bucket, id, List.of(valid), Set.of(), false, null);
        assertThat(policy.resolve(actor, request)).isSameAs(source);
        assertThatThrownBy(() -> policy.resolve(actor, request("original", room, bucket, id))).isInstanceOf(ConflictException.class);
        when(messages.findAttachments(room, bucket, id, null, 51)).thenReturn(java.util.Collections.nCopies(51, actual));
        assertThatThrownBy(() -> policy.resolve(actor, request)).isInstanceOf(ConflictException.class);
    }

    MessageSendRequest request(String content, UUID sourceRoom, String sourceBucket, UUID sourceId) {
        return new MessageSendRequest(UUID.randomUUID(), "TEXT", content, "PLAIN", null, null, null, null,
                sourceRoom, sourceBucket, sourceId, List.of(), Set.of(), false, null);
    }

    CanonicalMessage source(boolean deleted, String content) {
        return new CanonicalMessage(room, bucket, id, UUID.randomUUID(), "TEXT", content, "PLAIN", null, null,
                null, null, null, null, null, null, deleted, null, null, null, false, false, false,
                Instant.now(), UUID.randomUUID(), null, null, 0);
    }
}
