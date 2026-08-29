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

        // The canonical schema currently defines 80 named access-pattern tables,
        // including the bounded global-admin room directory, sanction-expiry and
        // pending-outbox projections.
        // Keep this exact so an accidental deletion or an undocumented table addition fails the guard.
        assertThat(cql.lines().filter(line -> line.startsWith("CREATE TABLE")).count()).isEqualTo(80);
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
                "owner_id uuid static",
                "owner_updated_at timestamp static",
                "CREATE TABLE IF NOT EXISTS media_assets_by_id",
                "CREATE TABLE IF NOT EXISTS message_buckets_by_conversation",
                "CREATE TABLE IF NOT EXISTS app_role_members_by_role",
                "CREATE TABLE IF NOT EXISTS conversation_roles_by_conversation",
                "CREATE TABLE IF NOT EXISTS community_directory_by_filter",
                "CREATE TABLE IF NOT EXISTS community_join_request_by_user",
                "CREATE TABLE IF NOT EXISTS community_join_requests_by_conversation",
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
                .contains("IF member_count = ? AND owner_id != ?")
                .contains("MembershipMutationResult.CAPACITY_REACHED")
                .contains("BatchStatement.builder(BatchType.LOGGED)");
    }

    @Test
    void ownershipTransferUsesOnlyTheMembershipPartitionAsAuthority() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));
        String conversationMetadata = schema.substring(
                schema.indexOf("CREATE TABLE IF NOT EXISTS conversations_by_id"),
                schema.indexOf("CREATE TABLE IF NOT EXISTS dm_conversation_by_pair"));

        assertThat(conversationMetadata).doesNotContain("owner_id uuid");
        assertThat(store)
                .contains("transferCurrentOwnerRoles.bind")
                .contains("transferNextOwnerRoles.bind")
                .contains("transferConversationOwner.bind")
                .contains("IF owner_id = ?")
                .doesNotContain("UPDATE conversations_by_id SET owner_id");
    }

    @Test
    void roomRoleLifecycleUsesPartitionLocalCatalogCasAndMembershipRevision() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        String repository = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalConversationRepository.java"));
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));

        assertThat(schema)
                .contains("role_revision bigint static")
                .contains("custom_role_count int static")
                .contains("lifecycle_state text")
                .contains("PRIMARY KEY ((conversation_id), role_code)")
                .doesNotContain("PRIMARY KEY ((conversation_id), role_position, role_id)");
        assertThat(repository)
                .contains("IF custom_role_count = ?")
                .contains("IF NOT EXISTS")
                .contains("lifecycle_state = 'DELETING'")
                .contains("IF role_id = ? AND lifecycle_state = 'DELETING'");
        assertThat(store)
                .contains("IF role_ids = ? AND role_revision = ?")
                .contains("IF role_revision = ?");
    }

    @Test
    void communityDiscoveryUsesAFilterAndShardPartitionWithoutFiltering() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        String store = Files.readString(Path.of(
                "src", "main", "java", "com", "chatapp", "chat_service", "canonical",
                "repository", "CanonicalCqlStore.java"));

        assertThat(schema)
                .contains("CREATE TABLE IF NOT EXISTS community_directory_by_filter")
                .contains("PRIMARY KEY ((discovery_filter, discovery_shard), name_normalized, conversation_id)")
                .contains("PRIMARY KEY ((conversation_id), requested_at, request_id)")
                .contains("WITH CLUSTERING ORDER BY (requested_at DESC, request_id ASC)");
        assertThat(store)
                .contains("listCommunityDirectory")
                .doesNotContain("ALLOW FILTERING");
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
                .contains("event.actorId() == null ? event.eventId() : event.actorId()")
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
