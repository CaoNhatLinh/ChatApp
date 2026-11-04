package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.exception.ConflictException;
import java.util.UUID;

/** Cleanup is safe to re-observe only after an irreversible message tombstone. */
final class DeletedMessagePins {
    private DeletedMessagePins() { }

    static MessageRepository.PinChange release(MessageRepository messages, CanonicalMessage deleted, UUID actor) {
        if (!Boolean.TRUE.equals(deleted.isDeleted())) {
            throw new IllegalArgumentException("pin cleanup requires a deleted message");
        }
        for (int attempt = 0; attempt < 5; attempt++) {
            var state = messages.findPinState(deleted.conversationId());
            if (!state.contains(deleted.messageBucket(), deleted.messageId())) {
                return new MessageRepository.PinChange(state, false);
            }
            try {
                return messages.changePin(deleted.conversationId(), deleted.messageBucket(), deleted.messageId(),
                        actor, false, state.revision());
            } catch (ConflictException concurrentChange) {
                // A new snapshot must fence each retry; never release a stale slot generation.
            }
        }
        throw new ConflictException("deleted message pin cleanup changed concurrently; retry deletion");
    }
}
