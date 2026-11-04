package com.chatapp.chat_service.canonical.call;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.testcontainers.containers.CassandraContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;

/** Opt-in only. Missing Docker fails this gate, never counts as a passing skip. */
@Testcontainers
class CallLifecycleCassandraIT {
    @Container static final CassandraContainer<?> cassandra = new CassandraContainer<>("cassandra:4.1")
            .withEnv("MAX_HEAP_SIZE", "512M").withEnv("HEAP_NEWSIZE", "128M")
            .withStartupTimeout(java.time.Duration.ofMinutes(3)).withInitScript("chat_app_complete.cql");
    static CqlSession first, second;
    static CassandraCallRepository a, b;
    static CassandraCallWorkRepository workA, workB;
    final UUID room = UUID.randomUUID(), caller = UUID.randomUUID(), callee = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-20T09:00:00Z");
    @BeforeAll static void connect() {
        first = client(); second = client();
        var mapper = new ObjectMapper().findAndRegisterModules();
        workA = new CassandraCallWorkRepository(first); workB = new CassandraCallWorkRepository(second);
        a = new CassandraCallRepository(first, mapper, workA, new CassandraIncomingCallRepository(first), new CassandraCallHistoryRepository(first));
        b = new CassandraCallRepository(second, mapper, workB, new CassandraIncomingCallRepository(second), new CassandraCallHistoryRepository(second));
    }
    static CqlSession client() { return CqlSession.builder().addContactPoint(cassandra.getContactPoint()).withLocalDatacenter(cassandra.getLocalDatacenter()).withKeyspace("chat_app").build(); }
    @AfterAll static void close() { if (second != null) second.close(); if (first != null) first.close(); }
    CallState call() { return CallState.ringing(room, UUID.randomUUID(), Uuids.startOf(now.toEpochMilli()), caller, callee, CallState.Type.VOICE, now, UUID.randomUUID()); }

    @Test void twoRealClientsCannotBothClaimTheSameConversationSlot() throws Exception {
        a.initialize(room); var slot = a.slot(room); var one = call(); var two = call();
        var gate = new CountDownLatch(1); ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            var p = pool.submit(() -> { gate.await(); return a.claim(slot, one); });
            var q = pool.submit(() -> { gate.await(); return b.claim(slot, two); }); gate.countDown();
            boolean won = p.get(30, TimeUnit.SECONDS), otherWon = q.get(30, TimeUnit.SECONDS);
            assertThat(won ^ otherWon).isTrue();
            var winner = won ? one : two; var loser = won ? two : one;
            assertThat(b.slot(room).activeCallId()).isEqualTo(winner.callId());
            assertThat(b.find(room, winner.callId())).isEqualTo(winner);
            assertThat(a.find(room, loser.callId())).isNull();
        } finally { pool.shutdownNow(); }
    }
    @Test void terminalBatchReleasesSlotButStaleWriterCannotReleaseReplacement() {
        a.initialize(room); var initial = a.slot(room); var call = call(); assertThat(a.claim(initial, call)).isTrue();
        var active = b.slot(room);
        var ended = call.apply(caller, CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        assertThat(b.change(active, call, ended)).isTrue(); assertThat(a.slot(room).activeCallId()).isNull();
        var replacement = call(); assertThat(a.claim(a.slot(room), replacement)).isTrue();
        assertThat(b.change(active, call, ended)).isFalse();
        assertThat(b.slot(room).activeCallId()).isEqualTo(replacement.callId());
        assertThat(a.find(room, call.callId())).isEqualTo(ended);
    }
    @Test void exactDeadlineTiesPageWithoutLossAndExpiryPrewriteKeepsExpectedFence() {
        a.initialize(room); var slot = a.slot(room); var call = call(); assertThat(a.claim(slot, call)).isTrue();
        var heartbeat = call.apply(caller, CallState.Action.HEARTBEAT, now.plusSeconds(1), UUID.randomUUID());
        assertThat(a.change(a.slot(room), call, heartbeat)).isTrue();
        var heartbeat2 = heartbeat.apply(caller, CallState.Action.HEARTBEAT, now.plusSeconds(2), UUID.randomUUID());
        assertThat(b.change(b.slot(room), heartbeat, heartbeat2)).isTrue();
        var seen = new ArrayList<CallWorkRepository.Work>(); CallWorkRepository.Key cursor = null;
        boolean exhausted = false;
        for (int page = 0; page < 100; page++) {
            var rows = workA.page(CallWorkRepository.shard(room), cursor, call.deadline(), 1);
            if (rows.isEmpty()) { exhausted = true; break; }
            seen.addAll(rows); cursor = rows.get(rows.size() - 1).key();
        }
        assertThat(exhausted).isTrue();
        var ours = seen.stream().filter(row -> row.key().conversationId().equals(room) && row.key().kind() == CallWorkRepository.Kind.EXPIRE).toList();
        assertThat(ours).hasSize(3);
        assertThat(ours.stream().map(row -> row.key().revision())).containsExactlyInAnyOrder(call.revision(), heartbeat.revision(), heartbeat2.revision());
        assertThat(ours.stream().filter(row -> row.key().revision().equals(call.revision())).findFirst().orElseThrow().expectedSlotRevision()).isEqualTo(slot.revision());
        for (var row : ours) workA.remove(row.key());
        assertThat(workB.page(CallWorkRepository.shard(room), null, call.deadline(), 101).stream().noneMatch(row -> row.key().conversationId().equals(room) && row.key().kind() == CallWorkRepository.Kind.EXPIRE)).isTrue();
    }
    @Test void publicationReceiptCannotAcknowledgeSupersededRevision() {
        a.initialize(room); var call = call(); assertThat(a.claim(a.slot(room), call)).isTrue();
        assertThat(b.publication(room, call.callId()).publishedVersion()).isZero();
        assertThat(b.markPublished(call, 0)).isTrue();
        var ended = call.apply(caller, CallState.Action.END, now.plusSeconds(1), UUID.randomUUID());
        assertThat(a.change(a.slot(room), call, ended)).isTrue();
        assertThat(b.publication(room, call.callId()).publishedVersion()).isEqualTo(1);
        assertThat(b.markPublished(call, 0)).isFalse();
        assertThat(a.markPublished(ended, 1)).isTrue();
        assertThat(b.publication(room, call.callId()).publishedVersion()).isEqualTo(ended.version());
    }
    @Test void slotFenceAndCheckpointAreSharedAcrossDrivers() {
        a.initialize(room); var initial = a.slot(room); var call = call();
        assertThat(b.fenceSlot(room, initial, UUID.randomUUID())).isTrue();
        assertThat(a.claim(initial, call)).isFalse();
        assertThat(a.claim(a.slot(room), call)).isTrue();
        int shard = CallWorkRepository.shard(room);
        var progress = workA.progress(shard); var page = workB.page(shard, null, call.deadline(), 1);
        assertThat(page).isNotEmpty();
        assertThat(workA.advance(shard, progress, page.get(0).key())).isTrue();
        assertThat(workB.advance(shard, progress, null)).isFalse();
        var advanced = workB.progress(shard); assertThat(advanced.after()).isEqualTo(page.get(0).key());
        assertThat(workB.advance(shard, advanced, null)).isTrue();
        assertThat(workA.progress(shard).after()).isNull();
    }
    @Test void incomingIndexPagesDeadlineTiesAcrossRealDriversAndIsScopedToCallee() {
        var indexA = new CassandraIncomingCallRepository(first);
        var indexB = new CassandraIncomingCallRepository(second);
        var one = call();
        var two = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), Uuids.startOf(now.toEpochMilli()), caller, callee, CallState.Type.VIDEO, now, UUID.randomUUID());
        indexA.register(one); indexA.register(two);
        var page = indexB.page(callee, now, null, 1);
        assertThat(page).hasSize(1);
        var next = indexA.page(callee, now, page.get(0), 1);
        assertThat(next).hasSize(1);
        assertThat(List.of(page.get(0), next.get(0))).containsExactlyInAnyOrder(
                new IncomingCallRepository.Key(one.deadline(), one.conversationId(), one.callId()),
                new IncomingCallRepository.Key(two.deadline(), two.conversationId(), two.callId()));
        assertThat(indexB.page(callee, now, next.get(0), 1)).isEmpty();
        assertThat(indexB.page(UUID.randomUUID(), now, null, 50)).isEmpty();
        assertThat(indexB.page(callee, one.deadline(), null, 50)).isEmpty();
        var options = first.execute("SELECT default_time_to_live FROM system_schema.tables WHERE keyspace_name='chat_app' AND table_name='incoming_calls_by_user'").one();
        assertThat(options).isNotNull();
        assertThat(options.getInt("default_time_to_live")).isEqualTo(86400);
    }
    @Test void historyPrewritesAcrossDriversKeepBothActorsAndRoomTiesWithoutGlobalCallIdCollision() {
        var historyA = new CassandraCallHistoryRepository(first);
        var historyB = new CassandraCallHistoryRepository(second);
        var one = call();
        var two = CallState.ringing(UUID.randomUUID(), one.callId(), one.startedOrder(), caller, callee,
                CallState.Type.VIDEO, now, UUID.randomUUID());
        a.initialize(room); assertThat(a.claim(a.slot(room), one)).isTrue();
        b.initialize(two.conversationId()); assertThat(b.claim(b.slot(two.conversationId()), two)).isTrue();
        var month = java.time.YearMonth.of(2026, 10);
        var head = historyB.own(caller, month, null, 1);
        var next = historyA.own(caller, month, head.get(0), 1);
        var expected = List.of(new CallHistoryRepository.Key(one.startedOrder(), one.conversationId(), one.callId()),
                new CallHistoryRepository.Key(two.startedOrder(), two.conversationId(), two.callId()));
        assertThat(head).hasSize(1); assertThat(next).hasSize(1);
        assertThat(List.of(head.get(0), next.get(0))).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(historyB.own(callee, month, null, 50)).containsExactlyInAnyOrderElementsOf(expected);
        assertThat(historyB.own(caller, month, next.get(0), 1)).isEmpty();
        assertThat(historyA.conversation(room, month, null, 50)).containsExactly(expected.get(0));
        assertThat(historyB.own(caller, month.minusMonths(1), null, 50)).isEmpty();
        assertThat(historyB.own(UUID.randomUUID(), month, null, 50)).isEmpty();
    }
}
