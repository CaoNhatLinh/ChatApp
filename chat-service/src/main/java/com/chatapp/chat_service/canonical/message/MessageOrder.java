package com.chatapp.chat_service.canonical.message;

import java.util.UUID;

/** CQL timeuuid order: full timestamp, then signed byte ordering of the remaining bits. */
final class MessageOrder {
    private MessageOrder() { }

    static int compare(UUID left, UUID right) {
        int timestamp = Long.compare(left.timestamp(), right.timestamp());
        if (timestamp != 0) return timestamp;
        // Cassandra AbstractTimeUUIDType.signedBytesToNativeLong.
        return Long.compare(left.getLeastSignificantBits() ^ 0x0080808080808080L,
                right.getLeastSignificantBits() ^ 0x0080808080808080L);
    }
}
