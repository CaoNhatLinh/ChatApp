package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class DeletedMessagePinsTest {
    private final MessageRepository messages = mock(MessageRepository.class);
    private final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased();
    private final String bucket = "2026-10-23-08:00";

    @Test void refusesCleanupWithoutAnIrreversibleTombstone() {
        assertThatThrownBy(() -> DeletedMessagePins.release(messages, message(false), actor))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(messages);
    }

    @Test void noSlotMeansNoMutationOrInventedRevision() {
        var state = new MessageRepository.PinState(12, List.of());
        when(messages.findPinState(room)).thenReturn(state);
        var result = DeletedMessagePins.release(messages, message(true), actor);
        assertThat(result.changed()).isFalse();
        assertThat(result.state()).isSameAs(state);
        verify(messages, never()).changePin(any(), any(), any(), any(), anyBoolean(), anyLong());
    }

    @Test void concurrentReplacementRequiresANewObservedRevision() {
        when(messages.findPinState(room)).thenReturn(pinned(1), pinned(3));
        when(messages.changePin(room, bucket, id, actor, false, 1)).thenThrow(new ConflictException("replaced"));
        var committed = new MessageRepository.PinChange(new MessageRepository.PinState(4, List.of()), true);
        when(messages.changePin(room, bucket, id, actor, false, 3)).thenReturn(committed);
        assertThat(DeletedMessagePins.release(messages, message(true), actor)).isSameAs(committed);
        var order = inOrder(messages);
        order.verify(messages).findPinState(room);
        order.verify(messages).changePin(room, bucket, id, actor, false, 1);
        order.verify(messages).findPinState(room);
        order.verify(messages).changePin(room, bucket, id, actor, false, 3);
    }

    @Test void concurrentRemovalDoesNotRepeatOrPublishAnotherChange() {
        when(messages.findPinState(room)).thenReturn(pinned(1), new MessageRepository.PinState(2, List.of()));
        when(messages.changePin(room, bucket, id, actor, false, 1)).thenThrow(new ConflictException("removed"));
        var result = DeletedMessagePins.release(messages, message(true), actor);
        assertThat(result.changed()).isFalse();
        assertThat(result.state().revision()).isEqualTo(2);
        verify(messages, times(1)).changePin(any(), any(), any(), any(), anyBoolean(), anyLong());
    }

    @Test void persistentContentionIsBoundedAndReported() {
        when(messages.findPinState(room)).thenReturn(pinned(1));
        when(messages.changePin(room, bucket, id, actor, false, 1)).thenThrow(new ConflictException("busy"));
        assertThatThrownBy(() -> DeletedMessagePins.release(messages, message(true), actor))
                .isInstanceOf(ConflictException.class).hasMessageContaining("retry deletion");
        verify(messages, times(5)).findPinState(room);
        verify(messages, times(5)).changePin(room, bucket, id, actor, false, 1);
    }

    @Test void storageFailureIsNotRetriedAsIfItWereContention() {
        when(messages.findPinState(room)).thenReturn(pinned(1));
        when(messages.changePin(room, bucket, id, actor, false, 1)).thenThrow(new IllegalStateException("storage unavailable"));
        assertThatThrownBy(() -> DeletedMessagePins.release(messages, message(true), actor))
                .isInstanceOf(IllegalStateException.class);
        verify(messages, times(1)).findPinState(room);
    }

    private MessageRepository.PinState pinned(long revision) {
        return new MessageRepository.PinState(revision, List.of(
                new MessageRepository.PinSlot((byte) 0, bucket, id, Uuids.timeBased())));
    }

    private CanonicalMessage message(boolean deleted) {
        return new CanonicalMessage(room, bucket, id, actor, "TEXT", "retained", "PLAIN", null, null,
                null, null, null, null, null, null, deleted, deleted ? actor : null,
                deleted ? Instant.now() : null, null, false, false, true, Instant.now(), UUID.randomUUID(), null, null, 2);
    }
}
