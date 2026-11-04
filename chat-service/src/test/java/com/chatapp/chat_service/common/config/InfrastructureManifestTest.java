package com.chatapp.chat_service.common.config;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.HashSet;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

class InfrastructureManifestTest {

    @Test void uploadReceiptSharesTheExistingAssetAuthorityWithoutAnUnusedIntentTable() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        var table = Pattern.compile("CREATE TABLE IF NOT EXISTS media_assets_by_id \\([\\s\\S]*?;").matcher(schema);
        assertThat(table.find()).isTrue();
        assertThat(table.group()).contains("asset_id uuid PRIMARY KEY", "upload_receipt text", "retention_locked boolean");
        assertThat(schema).doesNotContain("CREATE TABLE IF NOT EXISTS media_upload_intents");
    }

    @Test
    void freshCanonicalSchemaDoesNotDependOnLegacyUpgradeScripts() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        assertThat(Pattern.compile("(?m)^\\s*(ALTER|DROP)\\s", Pattern.CASE_INSENSITIVE)
                .matcher(schema).find()).isFalse();
        assertThat(schema).contains(
                "CREATE TABLE IF NOT EXISTS users_by_id (",
                "CREATE TABLE IF NOT EXISTS message_revisions_by_message (",
                "CREATE TABLE IF NOT EXISTS external_identity_owner_by_key (",
                "CREATE TABLE IF NOT EXISTS invite_state_by_token (");
        assertThat(schema).doesNotContain(
                "CREATE TABLE IF NOT EXISTS users (",
                "CREATE TABLE IF NOT EXISTS message_revisions (");
        Path historicalScripts = Path.of("..", "migrations");
        if (Files.exists(historicalScripts)) {
            try (var paths = Files.walk(historicalScripts)) {
                assertThat(paths.filter(Files::isRegularFile)
                        .filter(path -> path.toString().endsWith(".cql")).toList()).isEmpty();
            }
        }
    }

    @Test
    void canonicalSchemaContainsEveryTableReferencedByCassandraRepositories() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        var tables = new HashSet<String>();
        var declarations = Pattern.compile("CREATE TABLE IF NOT EXISTS ([a-z_]+)").matcher(schema);
        while (declarations.find()) tables.add(declarations.group(1));
        var queryTable = Pattern.compile("(?:FROM|INTO|UPDATE)\\s+([a-z_]+)");
        var referenced = new HashSet<String>();
        try (var paths = Files.walk(Path.of("src", "main", "java"))) {
            for (Path path : paths.filter(Files::isRegularFile)
                    .filter(p -> p.toString().endsWith(".java")).toList()) {
                String source = Files.readString(path);
                if (!source.contains("import com.datastax.oss.driver.api.core.CqlSession;")) continue;
                var queries = queryTable.matcher(source);
                while (queries.find()) {
                    String table = queries.group(1);
                    assertThat(tables).as("Query table %s in %s", table, path).contains(table);
                    referenced.add(table);
                }
            }
        }
        assertThat(referenced).as("Guard must actually inspect runtime queries").hasSizeGreaterThan(50);
    }

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

        // The canonical schema currently defines 91 named access-pattern tables,
        // including the bounded global-admin room directory, sanction-expiry and
        // pending-outbox projections, call authority, fenced expiry and incoming discovery.
        // Keep this exact so an accidental deletion or an undocumented table addition fails the guard.
        assertThat(cql.lines().filter(line -> line.startsWith("CREATE TABLE")).count()).isEqualTo(91);
        assertThat(cql).contains("CREATE TABLE IF NOT EXISTS report_create_commands", "PRIMARY KEY ((reporter_id, client_report_id))");
        assertThat(cql).contains("CREATE TABLE IF NOT EXISTS report_create_preparation_by_shard", "PRIMARY KEY ((work_shard), reporter_id, client_report_id)");
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
                "CREATE TABLE IF NOT EXISTS media_upload_recovery_by_shard",
                "CREATE TABLE IF NOT EXISTS media_deletion_recovery_by_shard",
                "CREATE TABLE IF NOT EXISTS media_orphan_candidates_by_shard",
                "upload_purpose text",
                "CREATE TABLE IF NOT EXISTS email_review_candidates_by_day",
                "PRIMARY KEY ((review_day), notification_id, user_id, notification_month)",
                "CREATE TABLE IF NOT EXISTS message_buckets_by_conversation",
                "CREATE TABLE IF NOT EXISTS message_reactions_by_conversation_bucket",
                "CREATE TABLE IF NOT EXISTS message_read_summary_by_conversation_bucket",
                "CREATE TABLE IF NOT EXISTS poll_state_by_poll",
                "option_counts map<int, bigint> static",
                "aggregate_version bigint static",
                "is_closed boolean static",
                "CREATE TABLE IF NOT EXISTS app_role_members_by_role",
                "CREATE TABLE IF NOT EXISTS conversation_roles_by_conversation",
                "CREATE TABLE IF NOT EXISTS community_directory_by_filter",
                "CREATE TABLE IF NOT EXISTS community_join_request_by_user",
                "CREATE TABLE IF NOT EXISTS community_join_requests_by_conversation",
                "CREATE TABLE IF NOT EXISTS invite_state_by_token",
                "resolution_lease_until timestamp",
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
    void incomingCallDiscoveryContainsOnlyOrderedKeysWithFiniteRetention() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        var table = Pattern.compile("CREATE TABLE IF NOT EXISTS incoming_calls_by_user \\([\\s\\S]*?;")
                .matcher(schema);
        assertThat(table.find()).isTrue();
        assertThat(table.group().replaceAll("\\s+", " ")).isEqualTo(
                "CREATE TABLE IF NOT EXISTS incoming_calls_by_user ( callee_id uuid, ring_deadline timestamp, "
                        + "conversation_id uuid, call_id uuid, PRIMARY KEY ((callee_id), ring_deadline, conversation_id, call_id) ) "
                        + "WITH CLUSTERING ORDER BY (ring_deadline ASC, conversation_id ASC, call_id ASC) "
                        + "AND default_time_to_live = 86400;");
        assertThat(table.find()).isFalse();
    }

    @Test
    void callHistoryUsesMonthScopedImmutableKeysAndNoFictionalMediaParticipants() throws IOException {
        String schema = Files.readString(Path.of("..", "chat_app_complete.cql"));
        var room = Pattern.compile("CREATE TABLE IF NOT EXISTS calls_by_conversation \\([\\s\\S]*?;").matcher(schema);
        var own = Pattern.compile("CREATE TABLE IF NOT EXISTS calls_by_user \\([\\s\\S]*?;").matcher(schema);
        assertThat(room.find()).isTrue(); assertThat(own.find()).isTrue();
        assertThat(room.group().replaceAll("\\s+", " ")).contains(
                "PRIMARY KEY ((conversation_id, call_month), started_at, call_id)",
                "CLUSTERING ORDER BY (started_at DESC, call_id DESC)");
        assertThat(own.group().replaceAll("\\s+", " ")).contains(
                "PRIMARY KEY ((user_id, call_month), started_at, conversation_id, call_id)",
                "CLUSTERING ORDER BY (started_at DESC, conversation_id DESC, call_id DESC)");
        assertThat(room.group() + own.group()).doesNotContain("signaling_provider", "joined_at", "status", "TTL");
        assertThat(schema).doesNotContain("CREATE TABLE IF NOT EXISTS call_participants_by_call");
        assertThat(room.find()).isFalse(); assertThat(own.find()).isFalse();
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
                "analytics", "CassandraAnalyticsRepository.java"));

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
                "messaging", "CassandraOutboxRepository.java"));

        assertThat(store)
                .contains("FROM outbox_pending_events_by_partition")
                .contains("BatchStatement.builder(BatchType.LOGGED)")
                .contains("deletePending.bind")
                .doesNotContain(".filter(row -> row.getInstant(\"published_at\") == null)");
    }
}
