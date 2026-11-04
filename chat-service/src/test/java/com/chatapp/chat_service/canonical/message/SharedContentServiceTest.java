package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.media.*;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class SharedContentServiceTest {
    final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    final MessageRepository messages = mock(MessageRepository.class);
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final FriendshipRepository friends = mock(FriendshipRepository.class);
    final SharedContentService service = new SharedContentService(store, messages, assets, friends);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), sender = UUID.randomUUID();
    final Instant hour = Instant.parse("2026-10-20T08:00:00Z");
    final String bucket = "2026-10-20-08:00";

    void member() {
        when(store.findConversationMember(room, actor)).thenReturn(membership(hour));
    }

    CanonicalConversationMember membership(Instant joinedAt) {
        return new CanonicalConversationMember(room, actor, Set.of(), joinedAt, null, null, null, "INHERIT", null, null);
    }
    @Test void sharedSourceDerivesItsPinFlagAfterAccessChecks() {
        member(); var message = message("source", false, false);
        when(messages.find(room, bucket, message.messageId())).thenReturn(message);
        when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(1,
                List.of(new MessageRepository.PinSlot((byte) 0, bucket, message.messageId(), Uuids.timeBased()))));
        assertThat(service.source(actor, room, bucket, message.messageId()).isPinned()).isTrue();
        verify(messages).findPinState(room);
    }
    CanonicalMessage message(String text, boolean attached, boolean deleted) {
        return new CanonicalMessage(room, bucket, Uuids.timeBased(), sender, "TEXT", text, "PLAIN",
                null, null, null, null, null, null, null, null, deleted, null, null, null, attached, false, false, hour, null, null, null, 0);
    }
    void history(CanonicalMessage message) {
        when(messages.findBuckets(eq(room), isNull(), eq(17))).thenReturn(List.of(new MessageRepository.MessageBucket(hour, bucket)));
        when(messages.findByBucket(room, bucket, 21)).thenReturn(List.of(message));
    }

    @Test void deniesNonMembersBeforeScanning() {
        assertThatThrownBy(() -> service.list(actor, room, "IMAGES", null)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(messages, assets);
    }
    @Test void rejectsInvalidKindAndCursorScope() {
        member();
        assertThatThrownBy(() -> service.list(actor, room, "NOPE", null)).isInstanceOf(BadRequestException.class);
        var m = message("https://example.com", false, false); history(m);
        var page = service.list(actor, room, "LINKS", null);
        assertThatThrownBy(() -> service.list(actor, room, "IMAGES", page.nextCursor())).isInstanceOf(BadRequestException.class);
    }

    @Test void forgedLinkCursorCannotResumeAnAttachmentPage() {
        member();
        String raw = actor + "/" + room + "/LINKS|" + hour + "||" + bucket + "|" + Uuids.timeBased() + "|" + UUID.randomUUID();
        String forged = Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        assertThatThrownBy(() -> service.list(actor, room, "LINKS", forged)).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(messages, assets);
    }

    @Test void listDoesNotReturnLinksReadUnderAReplacedMembership() {
        when(store.findConversationMember(room, actor)).thenReturn(membership(hour), membership(hour.plusSeconds(1)));
        history(message("https://example.com", false, false));

        assertThatThrownBy(() -> service.list(actor, room, "LINKS", null)).isInstanceOf(ForbiddenException.class);
        verify(store, times(2)).findConversationMember(room, actor);
    }

    @Test void sourceDoesNotReturnContentAfterMembershipIsRevokedDuringTheRead() {
        when(store.findConversationMember(room, actor)).thenReturn(membership(hour), null);
        var source = message("private", false, false);
        when(messages.find(room, bucket, source.messageId())).thenReturn(source);
        when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(0, List.of()));

        assertThatThrownBy(() -> service.source(actor, room, bucket, source.messageId())).isInstanceOf(ForbiddenException.class);
        verify(store, times(2)).findConversationMember(room, actor);
    }
    @Test void extractsSafeDeduplicatedLinksWithoutFetchingRemotePreviews() {
        member(); history(message("https://example.com/a. https://example.com/a https://user:pass@example.com javascript:bad", false, false));
        var page = service.list(actor, room, "LINKS", null);
        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).url()).isEqualTo("https://example.com/a");
        assertThat(page.hasNext()).isTrue();
        verifyNoInteractions(assets);
    }
    @Test void excludesDeletedAndBlockedSenders() {
        member(); var deleted = message("https://example.com", false, true); history(deleted);
        assertThat(service.list(actor, room, "LINKS", null).content()).isEmpty();
        var blocked = message("https://example.com", false, false); history(blocked);
        when(friends.isBlocked(actor, sender)).thenReturn(true);
        assertThat(service.list(actor, room, "LINKS", null).content()).isEmpty();
        when(messages.find(room, bucket, blocked.messageId())).thenReturn(blocked);
        assertThatThrownBy(() -> service.source(actor, room, bucket, blocked.messageId())).isInstanceOf(NotFoundException.class);
    }
    @Test void readsAllShardsAndContinuesAtOlderHourEvenForEmptyFilteredPage() {
        member();
        var buckets = new ArrayList<MessageRepository.MessageBucket>();
        for (int i = 0; i < 16; i++) buckets.add(new MessageRepository.MessageBucket(hour, "2026-10-20-08:" + String.format("%02d", i)));
        buckets.add(new MessageRepository.MessageBucket(hour.minusSeconds(3600), "2026-10-20-07:00"));
        when(messages.findBuckets(room, null, 17)).thenReturn(buckets);
        var page = service.list(actor, room, "IMAGES", null);
        assertThat(page.content()).isEmpty(); assertThat(page.hasNext()).isTrue();
        service.list(actor, room, "IMAGES", page.nextCursor());
        verify(messages).findBuckets(room, hour.minusSeconds(3600), 17);
        verify(messages, times(16)).findByBucket(eq(room), anyString(), eq(21));
    }
    @Test void attachmentContinuationDoesNotLoseFilesInLargeMessageAndTrustsAssetMetadata() {
        member(); var m = message("files", true, false); history(m);
        List<CanonicalAttachment> refs = new ArrayList<>();
        for (int i = 0; i < 25; i++) refs.add(new CanonicalAttachment(UUID.randomUUID(), UUID.randomUUID(), "p", "k", "untrusted", "text/plain", 1L, null, null, null, "https://untrusted.invalid", false));
        when(messages.findAttachments(room, bucket, m.messageId(), null, 25)).thenReturn(refs);
        var first = refs.get(0);
        when(assets.findById(first.assetId())).thenReturn(new MediaAsset(first.assetId(), sender, "p", "k", "https://files.example/a.png", "actual.png", "image/png", 12, null, null, null, null, "READY", null, null, hour, null));
        var page = service.list(actor, room, "IMAGES", null);
        assertThat(page.content()).hasSize(1);
        assertThat(page.content().get(0).name()).isEqualTo("actual.png");
        when(messages.find(room, bucket, m.messageId())).thenReturn(m);
        service.list(actor, room, "IMAGES", page.nextCursor());
        verify(messages).findAttachments(room, bucket, m.messageId(), refs.get(24).attachmentId(), 25);
    }
    @Test void membershipIsRecheckedOnContinuation() {
        member(); history(message("https://example.com", false, false));
        var page = service.list(actor, room, "LINKS", null);
        when(store.findConversationMember(room, actor)).thenReturn(null);
        assertThatThrownBy(() -> service.list(actor, room, "LINKS", page.nextCursor())).isInstanceOf(ForbiddenException.class);
    }

    @Test void scanContinuationUsesLastScannedTimeuuidRatherThanLastMatchingMessage() {
        member();
        var candidates = new ArrayList<CanonicalMessage>();
        for (int i = 0; i < 21; i++) candidates.add(message("no link", false, false));
        var buckets = List.of(new MessageRepository.MessageBucket(hour, bucket));
        when(messages.findBuckets(room, null, 17)).thenReturn(buckets);
        when(messages.findBuckets(room, hour, 17)).thenReturn(buckets);
        when(messages.findByBucket(room, bucket, 21)).thenReturn(candidates);
        var page = service.list(actor, room, "LINKS", null);
        assertThat(page.hasNext()).isTrue(); assertThat(page.content()).isEmpty();
        service.list(actor, room, "LINKS", page.nextCursor());
        verify(messages).findByBucketBefore(room, bucket, candidates.get(1).messageId(), 21);
    }

    @Test void deletedAssetsAreNotReturnedEvenWhenAttachmentReferencesRemain() {
        member(); var m = message("file", true, false); history(m);
        var ref = new CanonicalAttachment(UUID.randomUUID(), UUID.randomUUID(), "p", "k", "a.pdf", "application/pdf", 12L, null, null, null, null, false);
        when(messages.findAttachments(room, bucket, m.messageId(), null, 25)).thenReturn(List.of(ref));
        when(assets.findById(ref.assetId())).thenReturn(new MediaAsset(ref.assetId(), sender, "p", "k", "https://files.example/a.pdf", "a.pdf", "application/pdf", 12, null, null, null, null, "READY", null, null, hour, hour));
        assertThat(service.list(actor, room, "FILES", null).content()).isEmpty();
    }
}
