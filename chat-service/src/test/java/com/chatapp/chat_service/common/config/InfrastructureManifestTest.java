package com.chatapp.chat_service.common.config;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class InfrastructureManifestTest {

    @Test
    void composeManifestsKeepEveryRequiredLocalService() throws IOException {
        assertRequiredLocalServices(Path.of("docker-compose-full.yml"));
        assertRequiredLocalServices(Path.of("docker-compose.yml"));
    }

    private void assertRequiredLocalServices(Path manifestPath) throws IOException {
        Map<String, Object> compose;
        try (var reader = Files.newBufferedReader(manifestPath)) {
            compose = new Yaml().load(reader);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> services = (Map<String, Object>) compose.get("services");
        assertThat(services).containsKeys(
                "cassandra", "cassandra-schema", "redis", "kafka", "elasticsearch");
        assertThat(services).doesNotContainKey("cloudinary");
        assertThat(compose).containsKeys("volumes", "networks");
    }

    @Test
    void canonicalCqlRetainsRequiredProductionContracts() throws IOException {
        String cql = Files.readString(Path.of("..", "chat_app_complete.cql"));

        // The canonical schema currently defines 79 named access-pattern tables,
        // including the bounded global-admin room directory, sanction-expiry and
        // pending-outbox projections.
        // Keep this exact so an accidental deletion or an undocumented table addition fails the guard.
        assertThat(cql.lines().filter(line -> line.startsWith("CREATE TABLE")).count()).isEqualTo(79);
        assertThat(cql).contains("CREATE TABLE IF NOT EXISTS audit_events_by_month");
        assertThat(cql.lines().filter(line -> line.startsWith("CREATE TYPE")).count()).isEqualTo(2);
        assertThat(cql).contains(
                "CREATE TYPE IF NOT EXISTS attachment_ref",
                "storage_provider text",
                "storage_key text",
                "thumbnail_url text",
                "owner_id uuid",
                "message_interval_seconds int",
                "member_count int static",
                "max_members int static",
                "CREATE TABLE IF NOT EXISTS media_assets_by_id",
                "CREATE TABLE IF NOT EXISTS message_buckets_by_conversation",
                "CREATE TABLE IF NOT EXISTS app_role_members_by_role",
                "CREATE TABLE IF NOT EXISTS conversation_roles_by_conversation",
                "CREATE TABLE IF NOT EXISTS admin_conversations_by_month",
                "CREATE TABLE IF NOT EXISTS reports_by_reporter",
                "CREATE TABLE IF NOT EXISTS user_sanctions_by_expiry_day",
                "('APP_ADMIN', 'ROOM_READ'",
                "('APP_ADMIN', 'SESSION_REVOKE'",
                "('APP_ADMIN', 'ANALYTICS_READ'",
                "('APP_ADMIN', 'ROOM_MODERATE'",
                "('APP_ADMIN', 'REPORT_MANAGE'",
                "('APP_ADMIN', 'AUDIT_READ'",
                "target_type text",
                "reason_code text",
                "CREATE TABLE IF NOT EXISTS outbox_events_by_partition",
                "CREATE TABLE IF NOT EXISTS outbox_pending_events_by_partition");
    }

    @Test
    void membershipMutationsUseOnePartitionConditionalBatches() throws IOException {
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));

        assertThat(store)
                .contains("IF NOT EXISTS")
                .contains("IF member_count = ?")
                .contains("IF EXISTS")
                .contains("MembershipMutationResult.CAPACITY_REACHED")
                .contains("BatchStatement.builder(BatchType.LOGGED)");
    }

    @Test
    void analyticsQueryUsesTheFullCassandraPartitionAndStableMetricNames() throws IOException {
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));

        assertThat(store)
                .contains("VALUES (?, ?, ?, now(), ?, ?, ?, ?)")
                .contains("WHERE event_day = ? AND event_type = ? AND event_shard = ? LIMIT ?")
                .contains("event.createdAt().atZone(ZoneOffset.UTC).toLocalDate()")
                .contains("(byte) Math.floorMod(event.actorId().hashCode(), 16)")
                .contains("(int) row.getByte(\"event_shard\")")
                .contains("case \"CONVERSATION_CREATE\" -> \"ROOM_CREATED\";")
                .contains("case \"MESSAGE_SEND\" -> \"MESSAGE_SENT\";")
                .contains("case \"POLL_CREATE\" -> \"POLLS_CREATED\";");
    }

    @Test
    void outboxPublisherReadsPendingProjectionAndUsesAtomicLifecycleBatches() throws IOException {
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));

        assertThat(store)
                .contains("FROM outbox_pending_events_by_partition")
                .contains("BatchStatement.builder(BatchType.LOGGED)")
                .contains("deletePendingOutboxEvent.bind")
                .doesNotContain(".filter(row -> row.getInstant(\"published_at\") == null)");
    }
}
