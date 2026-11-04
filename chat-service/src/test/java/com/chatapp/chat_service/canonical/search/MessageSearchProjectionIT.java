package com.chatapp.chat_service.canonical.search;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import org.junit.jupiter.api.*;
import org.springframework.data.elasticsearch.client.ClientConfiguration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchClients;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchTemplate;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Opt-in real script/transport test; never included in the default no-Docker suite. */
@Testcontainers
class MessageSearchProjectionIT {
    @Container static ElasticsearchContainer elastic = new ElasticsearchContainer(
            "docker.elastic.co/elasticsearch/elasticsearch:8.18.8")
            .withEnv("xpack.security.enabled", "false")
            .withEnv("ES_JAVA_OPTS", "-Xms512m -Xmx512m");
    static ElasticsearchClient client;
    ElasticsearchTemplate operations;
    IndexCoordinates index;
    MessageSearchWriter writer;

    @BeforeAll static void connect() {
        client = ElasticsearchClients.createImperative(ClientConfiguration.builder()
                .connectedTo(elastic.getHttpHostAddress()).build());
    }
    @AfterAll static void close() throws Exception { if (client != null) client._transport().close(); }
    @BeforeEach void createIndex() {
        operations = spy(new ElasticsearchTemplate(client));
        index = IndexCoordinates.of("message-order-" + UUID.randomUUID());
        doReturn(index).when(operations).getIndexCoordinatesFor(MessageSearchDocument.class);
        assertThat(operations.indexOps(index).create(Map.of(),
                operations.indexOps(MessageSearchDocument.class).createMapping())).isTrue();
        writer = new MessageSearchWriterImpl(operations);
    }
    MessageSearchDocument read() {
        return operations.get("room:bucket:message", MessageSearchDocument.class, index);
    }
    @Test void deletedThenDelayedSendCannotResurrectIndexedContent() {
        writer.upsertSnapshot(MessageSearchWriterTest.snapshot(2, true), false, false);
        writer.upsertSnapshot(MessageSearchWriterTest.snapshot(0, false), false, false);
        assertThat(read().isDeleted()).isTrue();
        assertThat(read().getContent()).isEmpty();
        assertThat(read().getRevision()).isEqualTo(2);
        assertThat(read().isHasAttachments()).isFalse();
    }
    @Test void contentRevisionDoesNotResetPinOrLoseLateImmutableMentions() {
        var pin = MessageSearchWriterTest.snapshot(1, false);
        pin.setPinned(true);
        pin.setPinRevision(1L);
        writer.upsertSnapshot(pin, false, true);
        writer.upsertSnapshot(MessageSearchWriterTest.snapshot(2, false), false, false);
        var delayedSend = MessageSearchWriterTest.snapshot(0, false);
        delayedSend.setMentionedUserIds(Set.of("mentioned"));
        writer.upsertSnapshot(delayedSend, true, false);
        assertThat(read().getContent()).isEqualTo("revision-2");
        assertThat(read().getRevision()).isEqualTo(2);
        assertThat(read().isPinned()).isTrue();
        assertThat(read().getMentionedUserIds()).containsExactly("mentioned");
    }
    @Test void concurrentFirstWritersConvergeOnHighestContentRevision() throws Exception {
        try (var pool = Executors.newFixedThreadPool(2)) {
            var ready = new CyclicBarrier(2);
            var older = pool.submit(() -> writeAfter(ready, 0));
            var newer = pool.submit(() -> writeAfter(ready, 7));
            older.get(30, TimeUnit.SECONDS); newer.get(30, TimeUnit.SECONDS);
        }
        assertThat(read().getRevision()).isEqualTo(7);
        assertThat(read().getContent()).isEqualTo("revision-7");
    }
    void writeAfter(CyclicBarrier ready, int revision) {
        try {
            ready.await(10, TimeUnit.SECONDS);
            writer.upsertSnapshot(MessageSearchWriterTest.snapshot(revision, false), false, false);
        } catch (Exception failure) { throw new IllegalStateException(failure); }
    }
    @Test void independentPinRevisionRejectsDelayedPinAndUnpin() {
        var pinned = MessageSearchWriterTest.snapshot(1, false);
        pinned.setPinned(true); pinned.setPinRevision(1L);
        writer.upsertSnapshot(pinned, false, true);
        var unpinned = MessageSearchWriterTest.snapshot(1, false);
        unpinned.setPinRevision(2L);
        writer.upsertSnapshot(unpinned, false, true);
        writer.upsertSnapshot(pinned, false, true);
        assertThat(read().isPinned()).isFalse();
        assertThat(read().getPinRevision()).isEqualTo(2L);
        pinned.setPinRevision(3L);
        writer.upsertSnapshot(pinned, false, true);
        writer.upsertSnapshot(unpinned, false, true);
        assertThat(read().isPinned()).isTrue();
        assertThat(read().getPinRevision()).isEqualTo(3L);
    }
}
