package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.mockito.Mockito.*;

class StickerAuditRecoveryTest {
    final StickerRepository repository = mock(StickerRepository.class);
    final AuditRepository audit = mock(AuditRepository.class);
    final StickerAuditRecovery recovery = new StickerAuditRecovery(repository, audit);

    StickerRepository.Command command(UUID packId) {
        UUID id = UUID.randomUUID(), actor = UUID.randomUUID();
        var pack = new StickerRepository.Pack(packId, "Name", "", null, false, false, UUID.randomUUID(), Instant.now());
        var event = new CanonicalRoomAuditEvent(actor, "2026-10", com.datastax.oss.driver.api.core.uuid.Uuids.timeBased(),
                "STICKER_PACK_CREATED", "STICKER_CATALOG", packId.toString(), null, null, "SUCCESS", "Create",
                Map.of(), Map.of(), id, null, null, Instant.now());
        return new StickerRepository.Command(id, actor, "hash", pack, null, event);
    }
    @Test void auditIsPersistedBeforeAtomicAcknowledgementAndReplayUsesSameEvent() {
        var command = command(UUID.randomUUID());
        recovery.export(command);
        recovery.export(command);
        var order = inOrder(audit, repository);
        order.verify(audit).saveAuditEvent(command.audit());
        order.verify(repository).markAuditExported(command.pack().stickerPackId(), command.commandId());
        order.verify(audit).saveAuditEvent(command.audit());
        order.verify(repository).markAuditExported(command.pack().stickerPackId(), command.commandId());
    }
    @Test void unavailableAuditLeavesPendingWorkAndDoesNotStarveNextPack() {
        UUID packId = UUID.randomUUID(), next = UUID.randomUUID();
        var command = command(packId);
        when(repository.packIds(null, 1)).thenReturn(List.of(packId));
        when(repository.packIds(packId, 1)).thenReturn(List.of(next));
        when(repository.pendingCommands(packId, 25)).thenReturn(List.of(new StickerRepository.CommandEntry(command.commandId(), command)));
        when(repository.pendingCommands(next, 25)).thenReturn(List.of());
        doThrow(new IllegalStateException("audit unavailable")).when(audit).saveAuditEvent(command.audit());
        recovery.recover(); recovery.recover();
        verify(repository, never()).markAuditExported(any(), any());
        verify(repository).pendingCommands(next, 25);
    }
    @Test void boundedCatalogWalkWrapsToDiscoverNewAndPreviouslyFailedCommands() {
        UUID packId = UUID.randomUUID();
        when(repository.packIds(null, 1)).thenReturn(List.of(packId));
        when(repository.packIds(packId, 1)).thenReturn(List.of());
        when(repository.pendingCommands(packId, 25)).thenReturn(List.of());
        recovery.recover(); recovery.recover(); recovery.recover();
        verify(repository, times(2)).packIds(null, 1);
        verify(repository, times(2)).pendingCommands(packId, 25);
    }
}
