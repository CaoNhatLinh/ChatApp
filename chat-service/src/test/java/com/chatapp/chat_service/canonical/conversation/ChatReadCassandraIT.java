package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.media.*;
import com.chatapp.chat_service.canonical.message.*;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.CassandraContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;

/** Opt-in live CQL gate: -Pchat-cassandra-it. No existing host database is contacted. */
@Testcontainers
class ChatReadCassandraIT {
    @Container static final CassandraContainer<?> cassandra = new CassandraContainer<>("cassandra:4.1")
            .withEnv("MAX_HEAP_SIZE", "512M").withEnv("HEAP_NEWSIZE", "128M")
            .withStartupTimeout(java.time.Duration.ofMinutes(3))
            .withInitScript("chat_app_complete.cql");
    static CqlSession session;
    static CqlSession secondClient;
    CanonicalCqlStore store;
    CassandraMessageRepository messages;
    SharedContentService library;
    final UUID actor = UUID.randomUUID(), peer = UUID.randomUUID(), room = UUID.randomUUID();
    final Instant hour = Instant.parse("2026-10-20T08:00:00Z");

    @BeforeAll static void connect() {
        session = connectClient(); secondClient = connectClient();
    }
    static CqlSession connectClient() {
        return CqlSession.builder().addContactPoint(cassandra.getContactPoint())
                .withLocalDatacenter(cassandra.getLocalDatacenter()).withKeyspace("chat_app").build();
    }

    @Test void uploadClaimIsSingleWinnerAcrossTwoDrivers() throws Exception {
        var first = new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        var second = new MediaAssetRepository(secondClient, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        MediaAsset pending = uploadAsset(UUID.randomUUID(), "PENDING", null);
        var start = new CountDownLatch(1); var executor = Executors.newFixedThreadPool(2);
        try {
            var left = executor.submit(() -> { start.await(); return first.claimUpload(pending); });
            var right = executor.submit(() -> { start.await(); return second.claimUpload(pending); });
            start.countDown();
            assertThat(List.of(left.get(20, TimeUnit.SECONDS), right.get(20, TimeUnit.SECONDS))).containsExactlyInAnyOrder(true, false);
            assertThat(second.findById(pending.assetId())).isEqualTo(pending);
        } finally { executor.shutdownNow(); }
    }

    @Test void uploadCompletionCannotResetHistoryRetentionOrResurrectDeletion() {
        var first = new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        var second = new MediaAssetRepository(secondClient, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        for (boolean retained : List.of(true, false)) {
            UUID id = UUID.randomUUID(); MediaAsset pending = uploadAsset(id, "PENDING", null);
            assertThat(first.claimUpload(pending)).isTrue();
            var receipt = new MediaUploadReceipt(uploadAsset(id, "READY", "https://assets.example.test/winner.txt"), UUID.randomUUID(), List.of());
            assertThat(first.completeUpload(receipt)).isTrue();
            assertThat(second.findUploadReceipt(id)).isEqualTo(receipt);
            if (retained) assertThat(second.retainForHistory(id)).isTrue();
            else assertThat(second.claimDeletion(id)).isTrue();
            var late = new MediaUploadReceipt(uploadAsset(id, "READY", "https://assets.example.test/late.txt"), UUID.randomUUID(), List.of());
            assertThat(first.completeUpload(late)).isFalse();
            assertThat(first.findUploadReceipt(id)).isEqualTo(receipt);
            assertThat(first.findById(id).uploadStatus()).isEqualTo(retained ? "READY" : "DELETING");
            assertThat(first.claimDeletion(id)).isFalse();
        }
    }

    MediaAsset uploadAsset(UUID id, String status, String url) {
        return new MediaAsset(id, actor, "CLOUDINARY", "upload/" + id + ".txt", url, "file.txt", "text/plain", 3,
                null, null, null, "a".repeat(64), status, "PENDING", "PENDING", hour, null);
    }
    @AfterAll static void disconnect() {
        if (secondClient != null) secondClient.close();
        if (session != null) session.close();
    }
    @BeforeEach void seedMembership() {
        store = new CanonicalCqlStore(session);
        messages = new CassandraMessageRepository(session);
        library = new SharedContentService(store, messages, new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper()), new FriendshipRepository(session));
        store.createConversationMembership(List.of(new CanonicalConversationMember(room, actor, Set.of(),
                hour.minusSeconds(7200), null, null, null, "INHERIT", null, null)), 100, actor, hour);
    }
    CanonicalMessage message(String bucket, Instant at, String text, boolean attached) {
        return new CanonicalMessage(room, bucket, Uuids.startOf(at.toEpochMilli()), peer, "TEXT", text, "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null,
                attached, false, false, at, UUID.randomUUID(), null, null, 0);
    }
    void seedMessage(CanonicalMessage message) {
        assertThat(messages.createIfAbsent(message)).isTrue();
        messages.saveBucket(message);
        messages.repairSourceProjections(message);
    }

    @Test void twoClientsCreateOnceAndDelayedCreateCannotOverwriteEditOrDeletion() throws Exception {
        var original = message("2026-10-20-08:00", hour, "original", false);
        var other = new CassandraMessageRepository(secondClient);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var gate = new CountDownLatch(1);
            var first = executor.submit(() -> { gate.await(); return messages.createIfAbsent(original); });
            var second = executor.submit(() -> { gate.await(); return other.createIfAbsent(original); });
            gate.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(true, false);
            assertThat(messages.updateContent(room, original.messageBucket(), original.messageId(), "newer edit", peer)).isTrue();
            assertThat(other.createIfAbsent(original)).isFalse();
            assertThat(other.find(room, original.messageBucket(), original.messageId()).content()).isEqualTo("newer edit");
            assertThat(other.find(room, original.messageBucket(), original.messageId()).revision()).isEqualTo(1);
            assertThat(messages.delete(room, original.messageBucket(), original.messageId(), peer)).isTrue();
            assertThat(other.createIfAbsent(original)).isFalse();
            assertThat(other.find(room, original.messageBucket(), original.messageId()).isDeleted()).isTrue();
            assertThat(other.find(room, original.messageBucket(), original.messageId()).revision()).isEqualTo(2);
            assertThat(session.execute("SELECT revision_no FROM messages_by_conversation_bucket WHERE conversation_id=? AND message_bucket=? AND message_id=?",
                    room, original.messageBucket(), original.messageId()).one().getInt("revision_no")).isEqualTo(2);
        } finally { executor.shutdownNow(); }
    }

    List<SharedContentService.Item> all(String kind) {
        List<SharedContentService.Item> items = new ArrayList<>();
        String cursor = null;
        for (int page = 0; page < 100; page++) {
            var response = library.list(actor, room, kind, cursor);
            items.addAll(response.content());
            if (!response.hasNext()) return items;
            assertThat(response.nextCursor()).isNotBlank().isNotEqualTo(cursor);
            cursor = response.nextCursor();
        }
        throw new AssertionError("Archive traversal did not terminate within fixture bounds");
    }

    @Test void allSixteenShardsAndOlderHourSurviveRealCqlContinuation() {
        for (int shard = 0; shard < 16; shard++) {
            seedMessage(message("2026-10-20-08:" + String.format("%02d", shard), hour.plusSeconds(shard),
                    "https://example.test/shard/" + shard, false));
        }
        seedMessage(message("2026-10-20-07:00", hour.minusSeconds(3600), "https://example.test/older", false));
        var items = all("LINKS");
        assertThat(items).hasSize(17);
        assertThat(items.stream().map(SharedContentService.Item::id).distinct().count()).isEqualTo(17);
        assertThat(items.stream().map(SharedContentService.Item::url)).contains("https://example.test/older");
    }

    @Test void replyAuthorityAndRepairRoundTripParentBucketWithoutDuplicateIndex() {
        var parent = message("2026-10-20-08:03", hour, "parent", false);
        seedMessage(parent);
        Instant at = hour.plusSeconds(1);
        var child = new CanonicalMessage(room, "2026-10-20-08:04", Uuids.startOf(at.toEpochMilli()), actor,
                "TEXT", "reply", "PLAIN", parent.messageId(), parent.senderId(), null, null, null,
                null, null, null, false, null, null, null, false, false, false, at, UUID.randomUUID(),
                null, parent.messageBucket(), 0);
        seedMessage(child);
        messages.repairSourceProjections(child);
        messages.repairSourceProjections(child);
        var hydrated = messages.find(room, child.messageBucket(), child.messageId());
        assertThat(hydrated.replyToMessageBucket()).isEqualTo(parent.messageBucket());
        var query = session.prepare("SELECT * FROM replies_by_parent_message WHERE conversation_id = ? AND parent_message_bucket = ? AND parent_message_id = ?");
        var rows = session.execute(query.bind(room, parent.messageBucket(), parent.messageId())).all();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getUuid("message_id")).isEqualTo(child.messageId());
        assertThat(rows.get(0).getUuid("created_at")).isEqualTo(Uuids.startOf(at.toEpochMilli()));
        var tied = new CanonicalMessage(room, child.messageBucket(), Uuids.endOf(at.toEpochMilli()), actor,
                "TEXT", "same millisecond reply", "PLAIN", parent.messageId(), parent.senderId(), null, null, null,
                null, null, null, false, null, null, null, false, false, false, at, UUID.randomUUID(), null, parent.messageBucket(), 0);
        seedMessage(tied);
        var firstPage = messages.findReplies(room, parent.messageBucket(), parent.messageId(), null, 1);
        assertThat(firstPage).hasSize(1);
        assertThat(firstPage.get(0).messageId()).isEqualTo(child.messageId());
        var nextPage = messages.findReplies(room, parent.messageBucket(), parent.messageId(),
                new MessageRepository.ReplyPosition(firstPage.get(0).createdAt(), firstPage.get(0).messageId()), 1);
        assertThat(nextPage).hasSize(1);
        assertThat(nextPage.get(0).messageId()).isEqualTo(tied.messageId());
        var threads = new MessageThreadService(new com.chatapp.chat_service.canonical.service.ConversationAuthorizationService(
                store, new com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository(session)),
                messages, new FriendshipRepository(session));
        var firstThreadPage = threads.list(actor, room, parent.messageBucket(), parent.messageId(), 1, null);
        assertThat(firstThreadPage.content()).extracting(CanonicalMessage::messageId).containsExactly(child.messageId());
        assertThat(firstThreadPage.hasNext()).isTrue();
        var finalThreadPage = threads.list(actor, room, parent.messageBucket(), parent.messageId(), 1, firstThreadPage.nextCursor());
        assertThat(finalThreadPage.content()).extracting(CanonicalMessage::messageId).containsExactly(tied.messageId());
        assertThat(finalThreadPage.hasNext()).isFalse();
    }

    @Test void attachmentContinuationAndAssetFilteringUseActualUuidClusteringOrder() {
        var message = message("2026-10-20-08:00", hour, "attachments", true);
        seedMessage(message);
        var assets = new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
        for (int index = 0; index < 30; index++) {
            UUID attachmentId = UUID.randomUUID(), assetId = UUID.randomUUID();
            String mime = index % 2 == 0 ? "image/png" : "application/pdf";
            String name = "asset-" + index;
            assets.save(new MediaAsset(assetId, peer, "fixture", name, "https://assets.example.test/" + name,
                    name, mime, 100, null, null, null, null, "READY", null, null, hour, null));
            messages.saveAttachment(message, new AttachmentRequest(attachmentId, assetId, "fixture", name,
                    name, mime, 100L, null, null, null, "https://untrusted.example.test/thumbnail", false));
        }
        assertThat(all("IMAGES")).hasSize(15).allMatch(item -> item.mimeType().equals("image/png"));
        assertThat(all("FILES")).hasSize(15).allMatch(item -> item.mimeType().equals("application/pdf"));
        var first = library.list(actor, room, "IMAGES", null);
        session.execute("DELETE FROM conversation_members_by_conversation WHERE conversation_id=? AND user_id=?", room, actor);
        assertThatThrownBy(() -> library.list(actor, room, "IMAGES", first.nextCursor())).isInstanceOf(ForbiddenException.class);
    }

    @Test void independentClientsKeepReadPointerMonotonicAndCoveredProjectionRepairIsConditional() throws Exception {
        var earlier = message("2026-10-20-08:00", hour, "earlier", false);
        var latest = message("2026-10-20-08:01", hour.plusSeconds(1), "latest", false);
        seedMessage(earlier); seedMessage(latest);
        var other = new CassandraMessageRepository(secondClient);
        Instant joinedAt = store.findConversationMember(room, actor).joinedAt();
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            var gate = new CountDownLatch(1);
            var first = executor.submit(() -> { gate.await(); return messages.advanceReadPosition(room, actor, latest.messageId(), joinedAt, Instant.now()); });
            var second = executor.submit(() -> { gate.await(); return other.advanceReadPosition(room, actor, earlier.messageId(), joinedAt, Instant.now()); });
            gate.countDown(); first.get(20, TimeUnit.SECONDS); second.get(20, TimeUnit.SECONDS);
            assertThat(store.findConversationMember(room, actor).lastReadMessageId()).isEqualTo(latest.messageId());
        } finally { executor.shutdownNow(); }
        Instant activity = latest.createdAt();
        store.saveConversation(new CanonicalConversation(room, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "IT room", "it room",
                null, null, null, actor, actor, hour, hour, false, null, "OPEN", 0, null, "ALL",
                null, Set.of(), "vi", 100, 1, true, activity));
        var summary = session.getMetadata().getKeyspace("chat_app").orElseThrow()
                .getUserDefinedType("message_summary").orElseThrow().newValue().setUuid("message_id", latest.messageId());
        session.execute("INSERT INTO conversations_by_user (user_id,is_pinned,last_activity_at,conversation_id,unread_count,last_message,joined_at) VALUES (?,?,?,?,?,?,?)",
                actor, false, activity, room, 5, summary, joinedAt);
        store.clearReadConversationProjection(actor, room, earlier.messageId(), joinedAt);
        assertThat(unread(activity)).isEqualTo(5);
        store.clearReadConversationProjection(actor, room, latest.messageId(), joinedAt);
        assertThat(unread(activity)).isZero();
    }

    @Test void anotherClientRepairsAnOlderDirectoryKeyAfterTheLatestMessageIsRead() {
        store.saveConversation(new CanonicalConversation(room, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "IT room", "it room",
                null, null, null, actor, actor, hour, hour, false, null, "OPEN", 0, null, "ALL",
                null, Set.of(), "vi", 100, 1, false, hour));
        var member = store.findConversationMember(room, actor);
        store.addConversationMembershipProjection(actor, store.findConversation(room), member);
        var latest = message("2026-10-20-08:01", hour.plusSeconds(1), "latest", false);
        seedMessage(latest);
        store.updateLastMessageProjections(latest, "Peer", List.of());
        var old = store.scanConversationProjectionByUser(actor, null, 10).content().get(0);
        assertThat(old.lastActivityAt()).isEqualTo(hour);
        var repairer = new CanonicalCqlStore(secondClient);

        repairer.repairConversationProjectionActivity(actor, old, false);
        assertThat(store.findConversationProjectionAtActivity(actor, store.findConversation(room))).isNull();

        assertThat(messages.advanceReadPosition(room, actor, latest.messageId(), member.joinedAt(), hour.plusSeconds(2))).isTrue();
        repairer.repairConversationProjectionActivity(actor, old, false);
        assertThat(store.scanConversationProjectionByUser(actor, null, 10).content()).singleElement().satisfies(row -> {
            assertThat(row.lastActivityAt()).isEqualTo(latest.createdAt());
            assertThat(row.lastMessage().messageId()).isEqualTo(latest.messageId());
            assertThat(row.unreadCount()).isZero();
        });
        assertThat(store.findConversationProjectionAtActivity(actor, store.findConversation(room))).isNotNull();
    }

    @Test void creatorCanAdvanceUnreadOnceAfterAnotherClientRepairsItsRoomPreview() {
        store.saveConversation(new CanonicalConversation(room, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "IT room", "it room",
                null, null, null, actor, actor, hour, hour, false, null, "OPEN", 0, null, "ALL",
                null, Set.of(), "vi", 100, 1, false, hour));
        store.addConversationMembershipProjection(actor, store.findConversation(room), store.findConversationMember(room, actor));
        var sent = message("2026-10-20-08:01", hour.plusSeconds(1), "sent", false);
        seedMessage(sent);

        var retry = new CanonicalCqlStore(secondClient);
        retry.repairCanonicalConversationPreview(sent, "Peer");
        assertThat(store.scanConversationProjectionByUser(actor, null, 10).content()).singleElement().satisfies(row -> {
            assertThat(row.lastActivityAt()).isEqualTo(hour);
            assertThat(row.unreadCount()).isZero();
        });

        var members = new CanonicalConversationRepository(session).findMembers(room);
        store.updateLastMessageProjections(sent, "Peer", members);
        retry.updateLastMessageProjections(sent, "Peer", members);
        assertThat(store.scanConversationProjectionByUser(actor, null, 10).content()).singleElement().satisfies(row -> {
            assertThat(row.lastActivityAt()).isEqualTo(sent.createdAt());
            assertThat(row.lastMessage().messageId()).isEqualTo(sent.messageId());
            assertThat(row.unreadCount()).isEqualTo(1);
        });
    }

    @Test void directoryPagesKeepSameTimeIdOrderAcrossPinnedAndUnpinnedGroups() {
        List<UUID> expected = new ArrayList<>();
        for (int index = 0; index < 14; index++) {
            UUID conversationId = new UUID(0, 100 + index);
            boolean pinned = index < 3;
            Instant activity = index == 13 ? hour.minusSeconds(1) : hour;
            store.saveConversation(new CanonicalConversation(conversationId, "GROUP", "PRIVATE_LINK", "INVITE_ONLY",
                    "Directory " + index, "directory " + index, null, null, null, actor, actor, hour, hour,
                    false, null, "OPEN", 0, null, "ALL", null, Set.of(), "vi", 100, 1, true, activity));
            session.execute("INSERT INTO conversations_by_user (user_id,is_pinned,last_activity_at,conversation_id,unread_count) VALUES (?,?,?,?,?)",
                    actor, pinned, activity, conversationId, 0);
            expected.add(conversationId);
        }
        List<UUID> actual = new ArrayList<>();
        CanonicalCqlStore.ConversationProjectionCursor cursor = null;
        for (int index = 0; index < 20; index++) {
            var page = store.scanConversationProjectionByUser(actor, cursor, 2);
            page.content().forEach(row -> actual.add(row.conversation().conversationId()));
            if (!page.hasNext()) break;
            assertThat(page.nextCursor()).isNotNull().isNotEqualTo(cursor);
            cursor = page.nextCursor();
        }
        assertThat(actual).containsExactlyElementsOf(expected);
    }

    @Test void gifIdentitySurvivesActualCqlWriteReadAndAuthorizedSourceLookup() {
        var reference = new GifReference("GIPHY", "abc123");
        var message = new CanonicalMessage(room, "2026-10-20-08:00", Uuids.timeBased(), actor, "GIF", "", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null, false, false, false, hour,
                UUID.randomUUID(), reference, null, 0);
        seedMessage(message);
        assertThat(messages.find(room, message.messageBucket(), message.messageId()).gif()).isEqualTo(reference);
        assertThat(library.source(actor, room, message.messageBucket(), message.messageId()).gif()).isEqualTo(reference);
    }

    @org.junit.jupiter.params.ParameterizedTest
    @org.junit.jupiter.params.provider.ValueSource(booleans = {false, true})
    void delayedUnpinCannotDeleteAReusedSlotOrSameMessageNewGeneration(boolean sameMessage) {
        String bucket = "2026-10-23-08:00";
        UUID original = Uuids.timeBased(), next = sameMessage ? original : Uuids.timeBased();
        UUID oldGeneration = Uuids.timeBased(), nextGeneration = Uuids.timeBased();
        session.execute("INSERT INTO pinned_message_slots_by_conversation "
                + "(conversation_id,pin_slot,message_bucket,message_id,pinned_by,pinned_at,pin_revision) VALUES (?,?,?,?,?,?,?)",
                room, (byte) 0, bucket, original, actor, oldGeneration, 0L);
        var delayedClient = org.mockito.Mockito.mock(CqlSession.class,
                org.mockito.AdditionalAnswers.delegatesTo(session));
        org.mockito.Mockito.doAnswer(invocation -> {
            var statement = invocation.getArgument(0, com.datastax.oss.driver.api.core.cql.BoundStatement.class);
            var observed = session.execute(statement);
            if (statement.getPreparedStatement().getQuery().contains("SELECT pin_slot")) {
                secondClient.execute("DELETE FROM pinned_message_slots_by_conversation WHERE conversation_id=? AND pin_slot=?",
                        room, (byte) 0);
                secondClient.execute("INSERT INTO pinned_message_slots_by_conversation "
                        + "(conversation_id,pin_slot,message_bucket,message_id,pinned_by,pinned_at) VALUES (?,?,?,?,?,?)",
                        room, (byte) 0, bucket, next, actor, nextGeneration);
            }
            return observed;
        }).when(delayedClient).execute(org.mockito.ArgumentMatchers.any(com.datastax.oss.driver.api.core.cql.BoundStatement.class));
        assertThatThrownBy(() -> new CassandraMessageRepository(delayedClient).changePin(room, bucket, original, actor, false, 0L))
                .isInstanceOf(com.chatapp.chat_service.common.exception.ConflictException.class);
        var retained = secondClient.execute("SELECT message_id,pinned_at FROM pinned_message_slots_by_conversation "
                + "WHERE conversation_id=? AND pin_slot=?", room, (byte) 0).one();
        assertThat(retained.getUuid("message_id")).isEqualTo(next);
        assertThat(retained.getUuid("pinned_at")).isEqualTo(nextGeneration);
    }

    @Test void concurrentSameMessagePinsConsumeExactlyOneSlotAndRevision() throws Exception {
        var message = message("2026-10-23-08:00", hour, "Pin once", false);
        seedMessage(message);
        var secondRepository = new CassandraMessageRepository(secondClient);
        var barrier = new java.util.concurrent.CyclicBarrier(2);
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> {
                barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
                return messages.changePin(room, message.messageBucket(), message.messageId(), actor, true, 0L);
            });
            var second = pool.submit(() -> {
                barrier.await(10, java.util.concurrent.TimeUnit.SECONDS);
                return secondRepository.changePin(room, message.messageBucket(), message.messageId(), actor, true, 0L);
            });
            assertThat(first.get(30, java.util.concurrent.TimeUnit.SECONDS).state().contains(message.messageBucket(), message.messageId())).isTrue();
            assertThat(second.get(30, java.util.concurrent.TimeUnit.SECONDS).state().contains(message.messageBucket(), message.messageId())).isTrue();
        }
        var pins = session.execute("SELECT message_id,pin_revision FROM pinned_message_slots_by_conversation WHERE conversation_id=?", room).all();
        assertThat(pins).hasSize(1);
        assertThat(pins.get(0).getUuid("message_id")).isEqualTo(message.messageId());
        assertThat(pins.get(0).getLong("pin_revision")).isEqualTo(1L);
    }

    int unread(Instant activity) {
        return session.execute("SELECT unread_count FROM conversations_by_user WHERE user_id=? AND is_pinned=? AND last_activity_at=? AND conversation_id=?",
                actor, false, activity, room).one().getInt("unread_count");
    }
}
