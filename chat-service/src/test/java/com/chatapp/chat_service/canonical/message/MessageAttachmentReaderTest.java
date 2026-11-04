package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.media.*;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageAttachmentReaderTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = UUID.randomUUID(), assetId = UUID.randomUUID();
    final String bucket = "2026-10-23-00:00";
    final MessageRepository messages = mock(MessageRepository.class);
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final ConversationAuthorizationService authorization = mock(ConversationAuthorizationService.class);
    final FriendshipRepository friendships = mock(FriendshipRepository.class);
    final MessageAttachmentReader reader = new MessageAttachmentReader(messages, assets, authorization, friendships);
    final CanonicalMessage message = mock(CanonicalMessage.class);
    final CanonicalAttachment ref = new CanonicalAttachment(UUID.randomUUID(), assetId, "CLOUDINARY", "key",
            "image.png", "image/png", 10L, 100, 80, null, "https://untrusted.example/old.png", false);

    MessageAttachmentReaderTest() {
        when(messages.find(room, bucket, messageId)).thenReturn(message);
        when(message.senderId()).thenReturn(UUID.randomUUID());
        when(message.hasAttachments()).thenReturn(true);
        when(messages.findAttachments(room, bucket, messageId, null, 26)).thenReturn(List.of(ref));
    }
    MediaAsset asset(String state, Instant deletedAt, String url) {
        return new MediaAsset(assetId, UUID.randomUUID(), "CLOUDINARY", "key", url, "image.png", "image/png",
                10, 100, 80, null, "hash", state, "PENDING", "PENDING", Instant.now(), deletedAt);
    }
    @Test void authorizesBeforeLookingUpMessagesOrAssets() {
        doThrow(new ForbiddenException("not member")).when(authorization).requireMember(room, actor);
        assertThatThrownBy(() -> reader.list(actor, room, bucket, messageId, 25, null)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(assets);
        verify(messages, never()).findAttachments(any(), any(), any(), any(), anyInt());
        verify(messages, never()).find(any(), any(), any());
    }
    @Test void missingDeletedOrBlockedMessageCannotRevealAttachments() {
        when(messages.find(room, bucket, messageId)).thenReturn(null, message, message);
        when(message.isDeleted()).thenReturn(true, false);
        when(friendships.isBlocked(actor, message.senderId())).thenReturn(true);
        for (int i = 0; i < 3; i++) assertThatThrownBy(() -> reader.list(actor, room, bucket, messageId, 25, null))
                .isInstanceOf(NotFoundException.class);
        verifyNoInteractions(assets);
    }
    @Test void usesAssetAuthorityAndConfirmedThumbnailNotStoredClientUrl() {
        when(assets.findById(assetId)).thenReturn(asset("READY", null, "https://cdn.example/original.png"));
        when(assets.findThumbnails(assetId)).thenReturn(List.of(new MediaThumbnail(MediaThumbnail.Variant.SMALL,
                MediaThumbnail.Status.READY, "https://cdn.example/small.png", 100, 80, Instant.now())));
        var page = reader.list(actor, room, bucket, messageId, 25, null);
        assertThat(page.content()).hasSize(1);
        var item = page.content().get(0);
        assertThat(item.status()).isEqualTo(MessageAttachmentReader.Status.READY);
        assertThat(item.url()).isEqualTo("https://cdn.example/original.png");
        assertThat(item.thumbnailUrl()).isEqualTo("https://cdn.example/small.png");
        assertThat(item.byteSize()).isEqualTo(10L);
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
    }
    @Test void absentDeletedUnreadyOrUnsafeAssetIsExplicitlyUnavailable() {
        when(assets.findById(assetId)).thenReturn(null,
                asset("READY", Instant.now(), "https://cdn.example/a.png"),
                asset("UPLOADING", null, "https://cdn.example/a.png"),
                asset("READY", null, "javascript:alert(1)"),
                asset("READY", null, "https://user:pass@cdn.example/a.png"));
        for (int i = 0; i < 5; i++) {
            var item = reader.list(actor, room, bucket, messageId, 25, null).content().get(0);
            assertThat(item.status()).isEqualTo(MessageAttachmentReader.Status.UNAVAILABLE);
            assertThat(item.url()).isNull();
            assertThat(item.thumbnailUrl()).isNull();
        }
        verify(assets, never()).findThumbnails(any());
    }
    @Test void mismatchedAssetReferenceCannotExposeAnotherAsset() {
        var foreign = asset("READY", null, "https://cdn.example/other.png");
        when(assets.findById(assetId)).thenReturn(new MediaAsset(assetId, foreign.ownerId(), "CLOUDINARY", "other-key",
                foreign.publicUrl(), foreign.fileName(), foreign.mimeType(), 10, 100, 80, null, "hash", "READY",
                "PENDING", "PENDING", Instant.now(), null));
        assertThat(reader.list(actor, room, bucket, messageId, 25, null).content().get(0).url()).isNull();
        verify(assets, never()).findThumbnails(any());
    }
    @Test void boundedContinuationUsesLastReturnedAttachmentNotExtraRow() {
        var second = new CanonicalAttachment(UUID.randomUUID(), assetId, "CLOUDINARY", "key", "image.png", "image/png",
                10L, 100, 80, null, null, false);
        when(messages.findAttachments(room, bucket, messageId, null, 2)).thenReturn(List.of(ref, second));
        var page = reader.list(actor, room, bucket, messageId, 1, null);
        assertThat(page.content()).hasSize(1);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isEqualTo(ref.attachmentId());
        verify(assets, times(1)).findById(assetId);
        when(messages.findAttachments(room, bucket, messageId, ref.attachmentId(), 2)).thenReturn(List.of(second));
        assertThat(reader.list(actor, room, bucket, messageId, 1, ref.attachmentId()).hasNext()).isFalse();
    }
    @Test void noAttachmentsDoesNotReadAssetsAndMissingReferencesAreNotInvented() {
        when(message.hasAttachments()).thenReturn(false);
        assertThat(reader.list(actor, room, bucket, messageId, 25, null).content()).isEmpty();
        verify(messages, never()).findAttachments(any(), any(), any(), any(), anyInt());
        when(message.hasAttachments()).thenReturn(true);
        when(messages.findAttachments(room, bucket, messageId, null, 26)).thenReturn(List.of());
        assertThat(reader.list(actor, room, bucket, messageId, 25, null).content()).isEmpty();
        verifyNoInteractions(assets);
    }
    @Test void storageFailuresPropagateInsteadOfBecomingUnavailable() {
        when(assets.findById(assetId)).thenThrow(new IllegalStateException("database down"));
        assertThatThrownBy(() -> reader.list(actor, room, bucket, messageId, 25, null)).isInstanceOf(IllegalStateException.class);
    }
    @Test void invalidLimitsAreRejectedBeforeAnyStorageRead() {
        for (int limit : List.of(0, -1, 51)) assertThatThrownBy(() -> reader.list(actor, room, bucket, messageId, limit, null))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(authorization, assets);
        verify(messages, never()).find(any(), any(), any());
    }
}
