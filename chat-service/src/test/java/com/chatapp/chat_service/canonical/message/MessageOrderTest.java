package com.chatapp.chat_service.canonical.message;

import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class MessageOrderTest {
    @Test
    void retainsSubMillisecondTimeuuidOrder() {
        UUID first = Uuids.startOf(1790992800000L);
        UUID next = new UUID(first.getMostSignificantBits() + (1L << 32), first.getLeastSignificantBits());
        assertThat(Uuids.unixTimestamp(first)).isEqualTo(Uuids.unixTimestamp(next));
        assertThat(MessageOrder.compare(first, next)).isNegative();
    }

    @Test
    void breaksEqualTimestampTiesUsingCassandraSignedBytes() {
        long timestamp = Uuids.startOf(1790992800000L).getMostSignificantBits();
        UUID lower = new UUID(timestamp, 0x8080808080808080L);
        UUID higher = new UUID(timestamp, 0x808080808080807fL);
        assertThat(MessageOrder.compare(lower, higher)).isNegative();
        assertThat(MessageOrder.compare(higher, lower)).isPositive();
    }
}
