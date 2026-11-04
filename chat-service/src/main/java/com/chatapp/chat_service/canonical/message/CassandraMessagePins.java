package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.*;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.util.*;
import static com.chatapp.chat_service.canonical.message.MessageRepository.*;

/** One bounded, version-fenced pin aggregate per conversation partition. */
final class CassandraMessagePins {
    private final CqlSession session;
    private final PreparedStatement read, initialize, advance, claim, release;

    CassandraMessagePins(CqlSession session) {
        this.session = session;
        read = session.prepare("""
                SELECT pin_slot, message_bucket, message_id, pinned_by, pinned_at, pin_revision
                FROM pinned_message_slots_by_conversation WHERE conversation_id = ? LIMIT 6
                """);
        initialize = session.prepare("""
                UPDATE pinned_message_slots_by_conversation SET pin_revision = 0
                WHERE conversation_id = ? IF pin_revision = null
                """);
        advance = session.prepare("""
                UPDATE pinned_message_slots_by_conversation SET pin_revision = ?
                WHERE conversation_id = ? IF pin_revision = ?
                """);
        claim = session.prepare("""
                INSERT INTO pinned_message_slots_by_conversation
                    (conversation_id, pin_slot, message_bucket, message_id, pinned_by, pinned_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """);
        release = session.prepare("""
                DELETE FROM pinned_message_slots_by_conversation
                WHERE conversation_id = ? AND pin_slot = ?
                IF message_bucket = ? AND message_id = ? AND pinned_at = ?
                """);
    }

    PinState snapshot(UUID room) {
        var current = read(room);
        return current == null ? new PinState(0, List.of()) : current;
    }

    PinChange change(UUID room, String bucket, UUID message, UUID actor, boolean pinned, long expectedRevision) {
        for (int attempt = 0; attempt < 5; attempt++) {
            PinState state = read(room);
            if (state == null) {
                session.execute(initialize.bind(room).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                        .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL));
                continue;
            }
            var existing = state.slots().stream().filter(slot -> slot.message().equals(message)
                    && slot.bucket().equals(bucket)).findFirst().orElse(null);
            if (pinned == (existing != null)) return new PinChange(state, false);
            if (state.revision() != expectedRevision) throw new ConflictException("message pin state changed; reload and retry");
            if (pinned && state.slots().size() == 5) throw new ConflictException("a conversation can have at most 5 pinned messages");
            long next = Math.incrementExact(state.revision());
            var updated = new ArrayList<>(state.slots());
            var batch = BatchStatement.builder(BatchType.LOGGED)
                    .addStatement(advance.bind(next, room, state.revision()));
            if (pinned) {
                byte free = 0;
                while (containsSlot(state.slots(), free)) free++;
                var generation = Uuids.timeBased();
                batch.addStatement(claim.bind(room, free, bucket, message, actor, generation));
                updated.add(new PinSlot(free, bucket, message, generation));
            } else {
                batch.addStatement(release.bind(room, existing.number(), bucket, message, existing.generation()));
                updated.remove(existing);
            }
            if (session.execute(batch.setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)
                    .setSerialConsistencyLevel(DefaultConsistencyLevel.LOCAL_SERIAL).build()).wasApplied()) {
                return new PinChange(new PinState(next, updated), true);
            }
            // Do not silently apply an observed unpin to a replacement generation.
            if (!pinned) throw new ConflictException("message pin state changed; reload and retry");
        }
        throw new ConflictException("message pins changed concurrently; reload and retry");
    }

    private boolean containsSlot(List<PinSlot> slots, byte number) {
        return slots.stream().anyMatch(slot -> slot.number() == number);
    }

    private PinState read(UUID room) {
        var rows = session.execute(read.bind(room).setConsistencyLevel(DefaultConsistencyLevel.LOCAL_QUORUM)).all();
        if (rows.isEmpty()) return null;
        long revision = rows.get(0).getLong("pin_revision");
        List<PinSlot> slots = new ArrayList<>();
        Set<UUID> messages = new HashSet<>();
        Set<Byte> numbers = new HashSet<>();
        for (var row : rows) {
            if (row.isNull("pin_revision") || revision < 0 || row.getLong("pin_revision") != revision) {
                throw new IllegalStateException("pin aggregate revision is invalid");
            }
            if (row.isNull("pin_slot")) continue; // A valid empty aggregate has only its static revision.
            byte number = row.getByte("pin_slot");
            UUID message = row.getUuid("message_id"), generation = row.getUuid("pinned_at");
            String bucket = row.getString("message_bucket");
            if (number < 0 || number > 4 || message == null || generation == null || bucket == null || bucket.isBlank()
                    || !messages.add(message) || !numbers.add(number)) {
                throw new IllegalStateException("pin aggregate slot is invalid");
            }
            slots.add(new PinSlot(number, bucket, message, generation));
        }
        return new PinState(revision, slots);
    }

}
