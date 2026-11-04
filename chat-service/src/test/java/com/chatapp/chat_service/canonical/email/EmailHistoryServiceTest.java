package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class EmailHistoryServiceTest {
    private static final String MONTH = "2026-10";
    private final UUID actor = UUID.randomUUID();
    private final CassandraEmailHistoryReader reader = mock(CassandraEmailHistoryReader.class);
    private final EmailHistoryService service = new EmailHistoryService(reader);

    @Test
    void emptyFilteredPageAdvancesFromLastScannedKeyNotLookahead() {
        UUID first = Uuids.timeBased(), lastScanned = Uuids.timeBased(), lookahead = Uuids.timeBased();
        when(reader.notificationIds(actor, MONTH, null, 3)).thenReturn(List.of(first, lastScanned, lookahead));
        when(reader.deliveries(actor, MONTH, List.of(first, lastScanned))).thenReturn(List.of());
        when(reader.notificationIds(actor, MONTH, lastScanned, 3)).thenReturn(List.of(lookahead));
        when(reader.deliveries(actor, MONTH, List.of(lookahead))).thenReturn(List.of(
                new CassandraEmailHistoryReader.DeliveryItem(lookahead, "SENT", null, null)));

        var initial = service.list(actor, MONTH, null, 2);
        assertThat(initial.content()).isEmpty();
        assertThat(initial.hasNext()).isTrue();
        assertThat(initial.nextCursor()).isNotBlank();
        verify(reader, never()).deliveries(actor, MONTH, List.of(first, lastScanned, lookahead));

        var next = service.list(actor, MONTH, initial.nextCursor(), 2);
        assertThat(next.content()).extracting(EmailHistoryService.Item::notificationId).containsExactly(lookahead);
        assertThat(next.hasNext()).isFalse();
        assertThat(next.nextCursor()).isNull();
        verify(reader).notificationIds(actor, MONTH, lastScanned, 3);
    }

    @Test
    void cursorFromAnotherAccountOrMonthCannotReachTheReader() {
        UUID first = Uuids.timeBased(), lookahead = Uuids.timeBased();
        when(reader.notificationIds(actor, MONTH, null, 2)).thenReturn(List.of(first, lookahead));
        when(reader.deliveries(actor, MONTH, List.of(first))).thenReturn(List.of());
        String cursor = service.list(actor, MONTH, null, 1).nextCursor();
        clearInvocations(reader);

        assertThatThrownBy(() -> service.list(UUID.randomUUID(), MONTH, cursor, 1))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(actor, "2026-11", cursor, 1))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(reader);
    }

    @Test
    void malformedInputsAreRejectedBeforeStorage() {
        for (String invalidMonth : List.of("2026-1", "2026-00", "2026-13", "0000-01", "2026-01-01")) {
            assertThatThrownBy(() -> service.list(actor, invalidMonth, null, 10))
                    .isInstanceOf(BadRequestException.class);
        }
        for (int invalidLimit : List.of(0, -1, 51)) {
            assertThatThrownBy(() -> service.list(actor, MONTH, null, invalidLimit))
                    .isInstanceOf(BadRequestException.class);
        }
        for (String invalidCursor : List.of("%%%invalid", "x".repeat(161))) {
            assertThatThrownBy(() -> service.list(actor, MONTH, invalidCursor, 10))
                    .isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(reader);
    }

    @Test
    void sentAndDeliveredRemainDistinctAndUnknownStorageStatusIsRedacted() {
        UUID sent = Uuids.timeBased(), delivered = Uuids.timeBased(), unknown = Uuids.timeBased();
        var ids = List.of(sent, delivered, unknown);
        Instant attemptedAt = Instant.parse("2026-10-01T10:00:00Z");
        Instant deliveredAt = attemptedAt.plusSeconds(3);
        when(reader.notificationIds(actor, MONTH, null, 51)).thenReturn(ids);
        when(reader.deliveries(actor, MONTH, ids)).thenReturn(List.of(
                new CassandraEmailHistoryReader.DeliveryItem(sent, "SENT", attemptedAt, null),
                new CassandraEmailHistoryReader.DeliveryItem(delivered, "DELIVERED", attemptedAt, deliveredAt),
                new CassandraEmailHistoryReader.DeliveryItem(unknown, "unexpected-provider-value", null, null)));

        assertThat(service.list(actor, MONTH, null, 50).content()).containsExactly(
                new EmailHistoryService.Item(sent, EmailHistoryService.Status.SENT, attemptedAt, null),
                new EmailHistoryService.Item(delivered, EmailHistoryService.Status.DELIVERED, attemptedAt, deliveredAt),
                new EmailHistoryService.Item(unknown, EmailHistoryService.Status.UNKNOWN, null, null));
    }
}
