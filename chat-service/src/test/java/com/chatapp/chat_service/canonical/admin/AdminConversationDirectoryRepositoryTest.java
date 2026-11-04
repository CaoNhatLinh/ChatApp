package com.chatapp.chat_service.canonical.admin;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import java.util.stream.IntStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminConversationDirectoryRepositoryTest {
    private final CqlSession session = mock(CqlSession.class);
    private final Map<BoundStatement, List<Object>> bindings = new IdentityHashMap<>();
    private final List<BoundStatement> executed = new ArrayList<>();
    private final List<Row> directoryRows = new ArrayList<>();
    private final Map<UUID, Row> canonicalRows = new HashMap<>();
    private final AdminConversationDirectoryRepository repository;
    private boolean failImages;

    AdminConversationDirectoryRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            var prepared = mock(PreparedStatement.class);
            when(prepared.getQuery()).thenReturn(call.getArgument(0));
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                var bound = mock(BoundStatement.class, RETURNS_SELF);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                bindings.put(bound, Arrays.asList(binding.getArguments()));
                return bound;
            });
            return prepared;
        });
        when(session.execute(any(BoundStatement.class))).thenAnswer(call -> {
            BoundStatement bound = call.getArgument(0); executed.add(bound);
            String query = bound.getPreparedStatement().getQuery();
            var result = mock(ResultSet.class);
            if (query.contains("FROM admin_conversations_by_month")) when(result.all()).thenReturn(directoryRows);
            else if (query.contains("conversation_id IN ?")) {
                if (failImages) throw new IllegalStateException("image lookup unavailable");
                List<?> ids = (List<?>) bindings.get(bound).get(0);
                when(result.all()).thenReturn(ids.stream().map(canonicalRows::get).filter(Objects::nonNull).toList());
            } else if (query.contains("FROM conversations_by_id")) {
                when(result.one()).thenReturn(canonicalRows.get(bindings.get(bound).get(0)));
            } else if (query.contains("SELECT member_count")) {
                Row membership = mock(Row.class); when(membership.getInt("member_count")).thenReturn(2);
                when(result.one()).thenReturn(membership);
            } else when(result.all()).thenReturn(List.of());
            return result;
        });
        repository = new AdminConversationDirectoryRepository(session);
    }

    @Test void hydratesOnlyIndexedIdsAndPreservesDirectoryOrder() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        directoryRows.add(row(first, null)); directoryRows.add(row(second, null));
        canonicalRows.put(first, row(first, "https://assets.example.test/first.png"));
        canonicalRows.put(second, row(second, "https://assets.example.test/second.png"));
        var summaries = repository.list("2026-10", 100);
        assertThat(summaries).extracting(AdminConversationDirectoryRepository.AdminConversationSummary::conversationId).containsExactly(first, second);
        assertThat(summaries).extracting(AdminConversationDirectoryRepository.AdminConversationSummary::avatarUrl)
                .containsExactly("https://assets.example.test/first.png", "https://assets.example.test/second.png");
        assertThat(executed).hasSize(2);
        assertThat(executed.get(executed.size() - 1).getPreparedStatement().getQuery()).doesNotContain("ALLOW FILTERING", "SELECT *");
    }

    @Test void emptyDirectoryDoesNotIssueImageRead() {
        assertThat(repository.list("2026-10", 100)).isEmpty();
        assertThat(executed).hasSize(1);
    }

    @Test void clampsPageAndHydratesInBoundedGroupsNotOneQueryPerRoom() {
        IntStream.range(0, 200).forEach(index -> directoryRows.add(row(UUID.randomUUID(), null)));
        assertThat(repository.list("2026-10", 10000)).hasSize(200);
        assertThat(bindings.get(executed.get(0))).containsExactly("2026-10", 200);
        assertThat(executed).hasSize(8);
        assertThat(executed.subList(1, executed.size())).allSatisfy(statement -> {
            assertThat(statement.getPreparedStatement().getQuery()).contains("conversation_id IN ?");
            assertThat((List<?>) bindings.get(statement).get(0)).hasSizeBetween(1, 32);
        });
    }

    @Test void missingImageOrCanonicalRowIsNullNotAStockPhoto() {
        UUID first = UUID.randomUUID(), second = UUID.randomUUID();
        directoryRows.add(row(first, null)); directoryRows.add(row(second, null));
        canonicalRows.put(first, row(first, null));
        assertThat(repository.list("2026-10", 100)).allSatisfy(summary -> assertThat(summary.avatarUrl()).isNull());
    }

    @Test void imageReadFailureIsNotSilentlyConvertedToMissingImages() {
        directoryRows.add(row(UUID.randomUUID(), null)); failImages = true;
        assertThatThrownBy(() -> repository.list("2026-10", 100)).isInstanceOf(IllegalStateException.class).hasMessage("image lookup unavailable");
    }

    @Test void detailAndRecordCopiesRetainCanonicalImage() {
        UUID id = UUID.randomUUID(); canonicalRows.put(id, row(id, "https://assets.example.test/room.png"));
        var summary = repository.detail(id, 20);
        assertThat(summary.avatarUrl()).isEqualTo("https://assets.example.test/room.png");
        assertThat(summary.withMembers(List.of()).avatarUrl()).isEqualTo(summary.avatarUrl());
        assertThat(summary.withPolicy("READ_ONLY", 4, Instant.now()).avatarUrl()).isEqualTo(summary.avatarUrl());
        assertThat(summary.withArchived(true, Instant.now()).avatarUrl()).isEqualTo(summary.avatarUrl());
    }

    private Row row(UUID id, String avatar) {
        Row row = mock(Row.class); when(row.getUuid("conversation_id")).thenReturn(id);
        when(row.getString("avatar_url")).thenReturn(avatar);
        when(row.getInstant("created_at")).thenReturn(Instant.parse("2026-10-01T00:00:00Z"));
        when(row.getInstant("updated_at")).thenReturn(Instant.parse("2026-10-01T00:00:00Z"));
        return row;
    }
}
