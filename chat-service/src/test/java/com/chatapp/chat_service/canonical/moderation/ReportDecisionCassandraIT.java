package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.analytics.CassandraAnalyticsRepository;
import com.chatapp.chat_service.canonical.audit.CassandraAuditRepository;
import com.chatapp.chat_service.canonical.messaging.CassandraOutboxPublisher;
import com.chatapp.chat_service.canonical.messaging.CassandraOutboxRepository;
import com.chatapp.chat_service.canonical.messaging.KafkaDomainEventPublisher;
import com.chatapp.chat_service.canonical.messaging.OutboxRepository.OutboxEvent;
import com.chatapp.chat_service.canonical.messaging.ReportOutboxRoute;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.BatchStatement;
import com.datastax.oss.driver.api.core.cql.BoundStatement;
import com.datastax.oss.driver.api.core.cql.Statement;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.apache.kafka.common.serialization.StringSerializer;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.testcontainers.containers.CassandraContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.kafka.KafkaContainer;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Opt-in recovery gate with real Cassandra and Kafka; fault is injected at the driver boundary. */
@Testcontainers
final class ReportDecisionCassandraIT {
    @Container
    static final CassandraContainer<?> cassandra = new CassandraContainer<>("cassandra:4.1")
            .withEnv("MAX_HEAP_SIZE", "512M").withEnv("HEAP_NEWSIZE", "128M")
            .withStartupTimeout(Duration.ofMinutes(3)).withInitScript("chat_app_complete.cql");
    @Container
    static final KafkaContainer broker = new KafkaContainer("apache/kafka:3.9.1");

    @Test
    void exactlyOneCompetingDecisionWinsTheReporterCas() throws Exception {
        try (var first = client(); var second = client()) {
            var casGate = new CyclicBarrier(2);
            BeforeExecute synchronizeCas = statement -> {
                if (statement instanceof BoundStatement bound
                        && bound.getPreparedStatement().getQuery().contains("IF report_status = ?")) {
                    casGate.await(15, TimeUnit.SECONDS);
                }
            };
            var firstRepository = new ModerationRepository(intercept(first, synchronizeCas));
            var secondRepository = new ModerationRepository(intercept(second, synchronizeCas));
            var report = create(firstRepository);
            UUID firstDecision = Uuids.timeBased(), secondDecision = Uuids.timeBased();
            var pool = Executors.newFixedThreadPool(2);
            try {
                var resolve = pool.submit(() -> decide(firstRepository, report, "RESOLVED", firstDecision));
                var dismiss = pool.submit(() -> decide(secondRepository, report, "DISMISSED", secondDecision));
                var resolved = resolve.get(30, TimeUnit.SECONDS);
                var dismissed = dismiss.get(30, TimeUnit.SECONDS);

                assertThat((resolved == null) ^ (dismissed == null)).isTrue();
                var winner = resolved != null ? resolved : dismissed;
                var winnerId = resolved != null ? firstDecision : secondDecision;
                var work = secondRepository.reportWorkAuthority(ModerationRepository.reportWorkKey(report));
                assertThat(work.report().status()).isEqualTo(winner.status());
                assertThat(work.intent()).containsEntry("id", winnerId.toString());
                assertThat(secondRepository.findReport(winner.status(), report.reportDay(),
                        report.createdAtKey(), report.reportId())).isEqualTo(winner);
                assertThat(secondRepository.findReport("OPEN", report.reportDay(),
                        report.createdAtKey(), report.reportId())).isNull();
            } finally {
                pool.shutdownNow();
            }
        }
    }

    @Test
    void aDelayedKeyedSeedCannotUndoACompletedDecisionAndCreationAuditRecoversOnce() throws Exception {
        try (var first = client(); var second = client()) {
            var waiting = new CountDownLatch(1);
            var release = new CountDownLatch(1);
            var delayed = new ModerationRepository(intercept(first, statement -> {
                if (statement instanceof BatchStatement batch && containsQuery(batch, "INSERT INTO reports_by_reporter")) {
                    waiting.countDown();
                    if (!release.await(15, TimeUnit.SECONDS)) throw new IllegalStateException("seed was not released");
                }
            }));
            var repository = new ModerationRepository(second);
            var audit = new CassandraAuditRepository(second);
            var outbox = new CassandraOutboxRepository(second);
            var events = new CanonicalEventRecorder(audit, new CassandraAnalyticsRepository(second),
                    outbox, new ObjectMapper().findAndRegisterModules());
            UUID reporter = UUID.randomUUID(), target = UUID.randomUUID(), key = UUID.randomUUID();
            var users = mock(UserRepository.class);
            var targetAccount = mock(CanonicalUser.class);
            when(users.findById(target)).thenReturn(targetAccount);
            var firstService = reportService(delayed, events, users);
            var secondService = reportService(repository, events, users);
            var request = new ReportService.CreateReportRequest("USER", target, null, null, null, "SPAM", "integration fixture");
            var pool = Executors.newSingleThreadExecutor();
            try {
                var inFlight = pool.submit(() -> firstService.create(reporter, request, key));
                assertThat(waiting.await(15, TimeUnit.SECONDS)).isTrue();
                var created = secondService.create(reporter, request, key);
                var resolved = decide(repository, created, "RESOLVED", Uuids.timeBased());
                assertThat(resolved).isNotNull();
                release.countDown();

                assertThat(inFlight.get(20, TimeUnit.SECONDS)).isEqualTo(resolved);
                assertThat(secondService.create(reporter, request, key)).isEqualTo(resolved);
                assertThat(repository.listReportsByReporter(reporter, 10)).singleElement()
                        .satisfies(row -> assertThat(row.reportId()).isEqualTo(created.reportId()));
                assertThat(repository.findReport("OPEN", created.reportDay(), created.createdAtKey(), created.reportId())).isNull();

                var recovery = new ReportDecisionRecovery(repository, events, Optional.empty());
                for (int i = 0; i < ModerationRepository.REPORT_WORK_SHARDS; i++) recovery.recover();
                String month = created.reportDay().toString().substring(0, 7);
                assertThat(audit.findAuditEvents(month, 50)).filteredOn(event -> event.eventId().equals(created.createdAtKey()))
                        .singleElement().satisfies(event -> {
                            assertThat(event.action()).isEqualTo("REPORT_CREATED");
                            assertThat(event.afterState()).containsEntry("status", "OPEN");
                        });
                String partition = ReportOutboxRoute.partition(created.reportId());
                var pending = outbox.findReportPending(partition, null, 25).events().stream()
                        .filter(event -> event.eventId().equals(created.createdAtKey())).findFirst().orElseThrow();
                assertThat(pending.eventType()).isEqualTo("REPORT_CREATED");
                assertRealDeliveryAndReceipt(outbox, pending);
            } finally {
                release.countDown();
                pool.shutdownNow();
            }
        }
    }

    @Test
    void aFreshWorkerCompletesPreparedSubmissionWithoutAnotherHttpRequest() {
        UUID reporter = UUID.randomUUID(), target = UUID.randomUUID(), key = UUID.randomUUID();
        var request = new ReportService.CreateReportRequest("USER", target, null, null, null, "SPAM", "prepared report");
        var users = mock(UserRepository.class);
        var targetAccount = mock(CanonicalUser.class);
        when(users.findById(target)).thenReturn(targetAccount);
        try (var first = client()) {
            var interrupted = new ModerationRepository(intercept(first, statement -> {
                if (statement instanceof BoundStatement bound
                        && bound.getPreparedStatement().getQuery().contains("INSERT INTO report_create_commands")) {
                    throw new IllegalStateException("claim interrupted");
                }
            }));
            var service = reportService(interrupted, mock(CanonicalEventRecorder.class), users);
            assertThatThrownBy(() -> service.create(reporter, request, key))
                    .isInstanceOf(IllegalStateException.class).hasMessage("claim interrupted");
            assertThat(interrupted.findCreateCommand(reporter, key)).isNull();
            assertThat(interrupted.listReportsByReporter(reporter, 10)).isEmpty();
        }

        try (var restarted = client()) {
            var repository = new ModerationRepository(restarted);
            var audit = new CassandraAuditRepository(restarted);
            var outbox = new CassandraOutboxRepository(restarted);
            var events = new CanonicalEventRecorder(audit, new CassandraAnalyticsRepository(restarted), outbox,
                    new ObjectMapper().findAndRegisterModules());
            var recovery = new ReportDecisionRecovery(repository, events, Optional.empty());
            for (int i = 0; i < ModerationRepository.REPORT_WORK_SHARDS * 2; i++) recovery.recover();

            var reports = repository.listReportsByReporter(reporter, 10);
            assertThat(reports).hasSize(1);
            var report = reports.get(0);
            assertThat(report.description()).isEqualTo("prepared report");
            assertThat(repository.findReport("OPEN", report.reportDay(), report.createdAtKey(), report.reportId())).isEqualTo(report);
            assertThat(reportService(repository, events, users).create(reporter, request, key)).isEqualTo(report);
            String partition = ReportOutboxRoute.partition(report.reportId());
            assertThat(outbox.findReportPending(partition, null, 25).events())
                    .filteredOn(event -> event.eventId().equals(report.createdAtKey())).singleElement()
                    .satisfies(event -> assertThat(event.eventType()).isEqualTo("REPORT_CREATED"));
        }
    }

    @Test
    void freshClientRecoversAfterProjectionFailureAndDoesNotResendAfterReceipt() throws Exception {
        // An old occurrence must still be discoverable via the fixed report outbox route.
        Instant occurredAt = Instant.parse("2025-12-31T23:59:59.999Z");
        UUID decisionId = Uuids.startOf(occurredAt.toEpochMilli());
        ModerationRepository.ReportRow report;
        try (var original = client()) {
            var interrupted = new ModerationRepository(intercept(original, statement -> {
                if (statement instanceof BatchStatement batch && containsQuery(batch, "DELETE FROM reports_by_status_day")) {
                    throw new IllegalStateException("projection interrupted");
                }
            }));
            report = create(interrupted);
            assertThatThrownBy(() -> decide(interrupted, report, "RESOLVED", decisionId))
                    .isInstanceOf(IllegalStateException.class).hasMessage("projection interrupted");
        }

        try (var restarted = client()) {
            var repository = new ModerationRepository(restarted);
            var outbox = new CassandraOutboxRepository(restarted);
            var audit = new CassandraAuditRepository(restarted);
            var events = new CanonicalEventRecorder(audit, new CassandraAnalyticsRepository(restarted),
                    outbox, new ObjectMapper().findAndRegisterModules());
            var key = ModerationRepository.reportWorkKey(report);
            assertThat(repository.reportWorkPage(key.shard(), null, 25)).contains(key);
            assertThat(repository.reportWorkAuthority(key).report().status()).isEqualTo("RESOLVED");
            assertThat(repository.findReport("OPEN", report.reportDay(), report.createdAtKey(), report.reportId()))
                    .isNotNull();
            assertThat(repository.listReports("OPEN", report.reportDay(), 50))
                    .noneMatch(item -> item.reportId().equals(report.reportId()));
            String partition = ReportOutboxRoute.partition(report.reportId());
            assertThat(outbox.findReportPending(partition, null, 25).events())
                    .noneMatch(event -> event.eventId().equals(decisionId));

            var recovery = new ReportDecisionRecovery(repository, events, Optional.empty());
            for (int i = 0; i < ModerationRepository.REPORT_WORK_SHARDS; i++) recovery.recover();

            assertThat(repository.reportWorkAuthority(key).intent()).containsEntry("enqueued", "true");
            assertThat(repository.reportWorkPage(key.shard(), null, 25)).doesNotContain(key);
            assertThat(repository.findReport("OPEN", report.reportDay(), report.createdAtKey(), report.reportId()))
                    .isNull();
            var restored = repository.findReport("RESOLVED", report.reportDay(),
                    report.createdAtKey(), report.reportId());
            assertThat(restored.resolvedAt()).isEqualTo(occurredAt);
            assertThat(audit.findAuditEvents("2025-12", 50))
                    .filteredOn(event -> event.eventId().equals(decisionId)).singleElement()
                    .satisfies(event -> {
                        assertThat(event.resourceId()).isEqualTo(report.reportId().toString());
                        assertThat(event.afterState()).containsEntry("status", "RESOLVED");
                        assertThat(event.createdAt()).isEqualTo(occurredAt);
                    });
            var pending = outbox.findReportPending(partition, null, 25).events().stream()
                    .filter(event -> event.eventId().equals(decisionId)).findFirst().orElseThrow();

            assertRealDeliveryAndReceipt(outbox, pending);
        }
    }

    private static void assertRealDeliveryAndReceipt(CassandraOutboxRepository outbox, OutboxEvent pending) throws Exception {
        String topic = "report-restart-" + UUID.randomUUID();
        try (var admin = AdminClient.create(Map.of("bootstrap.servers", broker.getBootstrapServers()))) {
            admin.createTopics(List.of(new NewTopic(topic, 1, (short) 1))).all().get(20, TimeUnit.SECONDS);
        }
        var factory = new DefaultKafkaProducerFactory<String, String>(Map.of(
                "bootstrap.servers", broker.getBootstrapServers(), "acks", "all",
                "key.serializer", StringSerializer.class, "value.serializer", StringSerializer.class));
        try (var consumer = new KafkaConsumer<String, String>(
                Map.of("bootstrap.servers", broker.getBootstrapServers(), "enable.auto.commit", false),
                new StringDeserializer(), new StringDeserializer())) {
            var topicPartition = new TopicPartition(topic, 0);
            var assignment = List.of(topicPartition);
            consumer.assign(assignment);
            consumer.seekToBeginning(assignment);
            var sender = new KafkaDomainEventPublisher(new KafkaTemplate<>(factory), topic, Duration.ofSeconds(20));
            var publisher = new CassandraOutboxPublisher(outbox, sender, 25, 1);
            for (int i = 0; i < ReportOutboxRoute.SHARDS; i++) publisher.publishPending();
            assertThat(outbox.hasReportReceipt(pending.eventPartition(), pending.eventId())).isTrue();

            long publishedCount = consumer.endOffsets(assignment, Duration.ofSeconds(15)).get(topicPartition);
            var records = KafkaTestUtils.getRecords(consumer, Duration.ofSeconds(20), Math.toIntExact(publishedCount));
            assertThat(records.records(topicPartition)).filteredOn(record ->
                    new String(record.headers().lastHeader("eventId").value(), StandardCharsets.UTF_8).equals(pending.eventId().toString()))
                    .singleElement().satisfies(record -> {
                        assertThat(record.key()).isEqualTo(pending.aggregateId());
                        assertThat(record.value()).isEqualTo(pending.payloadJson());
                    });
            outbox.enqueue(pending);
            var restartedPublisher = new CassandraOutboxPublisher(outbox, sender, 25, 1);
            for (int i = 0; i < ReportOutboxRoute.SHARDS * 2; i++) restartedPublisher.publishPending();
            assertThat(outbox.findReportPending(pending.eventPartition(), null, 25).events())
                    .noneMatch(event -> event.eventId().equals(pending.eventId()));
            assertThat(consumer.endOffsets(assignment, Duration.ofSeconds(15)).get(topicPartition))
                    .isEqualTo(publishedCount);
        } finally {
            factory.destroy();
        }
    }

    private static ModerationRepository.ReportRow create(ModerationRepository repository) {
        return repository.createReport(UUID.randomUUID(), "CONVERSATION", null, UUID.randomUUID(),
                null, null, "SPAM", "integration fixture");
    }

    private static ReportService reportService(ModerationRepository repository, CanonicalEventRecorder events, UserRepository users) {
        return new ReportService(repository, mock(CanonicalCqlStore.class), mock(MessageRepository.class), users,
                events, mock(ConversationAuthorizationService.class));
    }

    private static boolean containsQuery(BatchStatement batch, String fragment) {
        for (var statement : batch) {
            if (statement instanceof BoundStatement bound && bound.getPreparedStatement().getQuery().contains(fragment)) {
                return true;
            }
        }
        return false;
    }

    private static ModerationRepository.ReportRow decide(ModerationRepository repository,
            ModerationRepository.ReportRow report, String status, UUID decisionId) {
        UUID moderator = UUID.randomUUID();
        return repository.transitionReport(report, status, moderator,
                Instant.ofEpochMilli(Uuids.unixTimestamp(decisionId)), "REVIEWED",
                moderator, "integration decision", decisionId);
    }

    private static CqlSession client() {
        return CqlSession.builder().addContactPoint(cassandra.getContactPoint())
                .withLocalDatacenter(cassandra.getLocalDatacenter()).withKeyspace("chat_app").build();
    }

    private static CqlSession intercept(CqlSession session, BeforeExecute hook) {
        return (CqlSession) Proxy.newProxyInstance(CqlSession.class.getClassLoader(),
                new Class<?>[]{CqlSession.class}, (proxy, method, args) -> {
                    if ("execute".equals(method.getName()) && args != null && args.length == 1
                            && args[0] instanceof Statement<?> statement) hook.before(statement);
                    try {
                        return method.invoke(session, args);
                    } catch (InvocationTargetException e) {
                        throw e.getCause();
                    }
                });
    }

    @FunctionalInterface
    private interface BeforeExecute {
        void before(Statement<?> statement) throws Exception;
    }
}
