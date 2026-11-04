package com.chatapp.chat_service.canonical.media;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static com.chatapp.chat_service.canonical.media.MediaThumbnail.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MediaThumbnailRepositoryTest {
    final CqlSession session = mock(CqlSession.class);
    final Map<BoundStatement, List<Object>> bindings = new IdentityHashMap<>();
    final UUID assetId = UUID.randomUUID(), owner = UUID.randomUUID();
    final Instant now = Instant.parse("2026-10-23T00:00:00Z");
    final MediaAssetRepository repository;

    MediaThumbnailRepositoryTest() {
        when(session.prepare(anyString())).thenAnswer(call -> {
            String query = call.getArgument(0);
            var prepared = mock(PreparedStatement.class);
            when(prepared.getQuery()).thenReturn(query);
            when(prepared.bind(any(Object[].class))).thenAnswer(binding -> {
                var bound = mock(BoundStatement.class, RETURNS_SELF);
                when(bound.getPreparedStatement()).thenReturn(prepared);
                bindings.put(bound, Arrays.asList(binding.getArguments()));
                return bound;
            });
            return prepared;
        });
        repository = new MediaAssetRepository(session, new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper());
    }

    @Test void persistsWinningReceiptAndMetadataWithConditionalAuthorityThenProjectsThumbnails() throws Exception {
        var rows = CloudinaryThumbnailPolicy.read(List.of(CloudinaryThumbnailPolicyTest.ready(Variant.SMALL),
                Map.of("transformation", CloudinaryThumbnailPolicy.transformation(Variant.MEDIUM), "state", "failed")),
                "https://res.cloudinary.com/test/image/upload/source.png", "source", now);
        var receipt = new MediaUploadReceipt(asset(), UUID.randomUUID(), rows);
        var result = mock(ResultSet.class); when(result.wasApplied()).thenReturn(true);
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        assertThat(repository.completeUpload(receipt)).isTrue();
        var commandCaptor = org.mockito.ArgumentCaptor.forClass(BoundStatement.class);
        verify(session).execute(commandCaptor.capture());
        BoundStatement command = commandCaptor.getValue();
        assertThat(command.getPreparedStatement().getQuery()).contains("upload_receipt=?", "upload_status='READY'", "IF upload_status='PENDING'", "checksum_sha256=?", "owner_id=?")
                .doesNotContain("retention_locked", "malware_scan_status", "moderation_status");
        verify(command).setConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(command).setSerialConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_SERIAL);
        var mapper = new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper();
        assertThat(mapper.readValue((String) bindings.get(command).get(4), MediaUploadReceipt.class)).isEqualTo(receipt);
        repository.repairUploadThumbnails(receipt);
        var captor = org.mockito.ArgumentCaptor.forClass(BatchStatement.class);
        verify(session).execute(captor.capture());
        BatchStatement batch = captor.getValue();
        assertThat(batch.getBatchType()).isEqualTo(BatchType.LOGGED);
        assertThat(batch.size()).isEqualTo(3);
        assertThat(batch.getConsistencyLevel()).isEqualTo(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_QUORUM);
        int index = 0;
        for (BatchableStatement<?> statement : batch) {
            BoundStatement bound = (BoundStatement) statement;
            var values = bindings.get(bound);
            assertThat(values.get(0)).isEqualTo(assetId);
            var row = rows.get(index);
            assertThat(bound.getPreparedStatement().getQuery()).contains("media_thumbnails_by_asset", "status").doesNotContain("media_assets_by_id");
            assertThat(values).containsExactly(assetId, row.variant().name(), row.status().name(), row.url(), row.width(), row.height(), now);
            index++;
        }
    }

    @Test void pendingClaimBindsFrozenIdentityAndCannotResetAnExistingAsset() {
        var result = mock(ResultSet.class); when(result.wasApplied()).thenReturn(false);
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        assertThat(repository.claimUpload(asset())).isFalse();
        var captor = org.mockito.ArgumentCaptor.forClass(BoundStatement.class); verify(session).execute(captor.capture());
        BoundStatement command = captor.getValue();
        assertThat(command.getPreparedStatement().getQuery()).contains("IF NOT EXISTS", "'PENDING'", "retention_locked", "upload_purpose");
        assertThat(bindings.get(command)).containsExactly(assetId, owner, "CLOUDINARY", "source", "source.png", "image/png", 12L, "a".repeat(64), now, null);
        verify(command).setConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_QUORUM);
        verify(command).setSerialConsistencyLevel(com.datastax.oss.driver.api.core.DefaultConsistencyLevel.LOCAL_SERIAL);
    }

    @Test void receiptReadsRoundTripAndMalformedOrMismatchedIdentityFailsClosed() throws Exception {
        var mapper = new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper();
        var receipt = new MediaUploadReceipt(asset(), UUID.randomUUID(), CloudinaryThumbnailPolicy.read(null,
                "https://res.cloudinary.com/test/image/upload/source.png", "source", now));
        var row = mock(Row.class); var result = mock(ResultSet.class); when(result.one()).thenReturn(row);
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        when(row.getString("upload_receipt")).thenReturn(mapper.writeValueAsString(receipt));
        assertThat(repository.findUploadReceipt(assetId)).isEqualTo(receipt);
        assertThatThrownBy(() -> repository.findUploadReceipt(UUID.randomUUID())).isInstanceOf(IllegalStateException.class);
        for (String json : new String[]{null, "null", "{}", "{bad json}"}) {
            when(row.getString("upload_receipt")).thenReturn(json);
            assertThatThrownBy(() -> repository.findUploadReceipt(assetId)).isInstanceOf(IllegalStateException.class);
        }
        for (String field : List.of("byteSize", "durationMs", "width", "height")) {
            com.fasterxml.jackson.databind.node.ObjectNode json = mapper.valueToTree(receipt);
            ((com.fasterxml.jackson.databind.node.ObjectNode) json.get("asset")).put(field, -1);
            when(row.getString("upload_receipt")).thenReturn(mapper.writeValueAsString(json));
            assertThatThrownBy(() -> repository.findUploadReceipt(assetId)).as(field).isInstanceOf(IllegalStateException.class);
        }
    }

    @Test void readsOnlyOneAssetAndReturnsPersistedStatesInCanonicalOrder() {
        var result = mock(ResultSet.class);
        var rows = List.of(row(Variant.LARGE, Status.UNAVAILABLE), row(Variant.SMALL, Status.READY), row(Variant.MEDIUM, Status.FAILED));
        when(result.iterator()).thenReturn(rows.iterator());
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        assertThat(repository.findThumbnails(assetId)).extracting(MediaThumbnail::status)
                .containsExactly(Status.READY, Status.FAILED, Status.UNAVAILABLE);
        var boundCaptor = org.mockito.ArgumentCaptor.forClass(BoundStatement.class);
        verify(session).execute(boundCaptor.capture());
        assertThat(boundCaptor.getValue().getPreparedStatement().getQuery()).contains("WHERE asset_id=? LIMIT 4")
                .doesNotContain("ALLOW FILTERING");
        assertThat(bindings.get(boundCaptor.getValue())).containsExactly(assetId);
        verify(result, never()).all();
    }

    @Test void malformedPersistedStatusIsNotSilentlyReportedAsReadyOrEmpty() {
        var invalid = row(Variant.SMALL, Status.UNAVAILABLE);
        when(invalid.getString("status")).thenReturn("UNKNOWN");
        var result = mock(ResultSet.class);
        when(result.iterator()).thenReturn(List.of(invalid).iterator());
        when(session.execute(any(BoundStatement.class))).thenReturn(result);
        assertThatThrownBy(() -> repository.findThumbnails(assetId)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test void duplicateOrIncompleteCommandOutcomesAreRejectedBeforeIo() {
        var row = new MediaThumbnail(Variant.SMALL, Status.FAILED, null, null, null, now);
        assertThatThrownBy(() -> new MediaUploadReceipt(asset(), UUID.randomUUID(), List.of(row, row, row)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MediaUploadReceipt(asset(), UUID.randomUUID(), List.of(row)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(session, never()).execute(any(BatchStatement.class));
    }

    @Test void databaseFailuresAreNotConvertedIntoSuccessfulWritesOrEmptyReads() {
        when(session.execute(any(BoundStatement.class))).thenThrow(new IllegalStateException("unavailable"));
        assertThatThrownBy(() -> repository.findThumbnails(assetId)).isInstanceOf(IllegalStateException.class);
        when(session.execute(any(BatchStatement.class))).thenThrow(new IllegalStateException("unavailable"));
        assertThatThrownBy(() -> repository.repairUploadThumbnails(new MediaUploadReceipt(asset(), UUID.randomUUID(), CloudinaryThumbnailPolicy.read(null,
                "https://res.cloudinary.com/test/image/upload/source.png", "source", now)))).isInstanceOf(IllegalStateException.class);
    }

    Row row(Variant variant, Status status) {
        var row = mock(Row.class);
        when(row.getString("variant")).thenReturn(variant.name());
        when(row.getString("status")).thenReturn(status.name());
        when(row.getInstant("created_at")).thenReturn(now);
        when(row.isNull("width")).thenReturn(status != Status.READY);
        when(row.isNull("height")).thenReturn(status != Status.READY);
        if (status == Status.READY) {
            when(row.getString("thumbnail_url")).thenReturn("https://res.cloudinary.com/test/small.png");
            when(row.getInt("width")).thenReturn(2);
            when(row.getInt("height")).thenReturn(3);
        }
        return row;
    }
    MediaAsset asset() {
        return new MediaAsset(assetId, owner, "CLOUDINARY", "source", "https://res.cloudinary.com/test/source.png",
                "source.png", "image/png", 12, 2, 3, null, "a".repeat(64), "READY", "PENDING", "PENDING", now, null);
    }
}
