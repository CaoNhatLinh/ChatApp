package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.audit.AuditRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class SystemSettingsAuditRecoveryTest {
    private final SystemSettingsRepository repository = mock(SystemSettingsRepository.class);
    private final AuditRepository audit = mock(AuditRepository.class);
    private final SystemSettingsAuditRecovery recovery = new SystemSettingsAuditRecovery(repository, audit);

    @Test void auditRetriesReuseTheOriginalEventAndAcknowledgeOnlyAfterUpsert() {
        var command = command(SystemSetting.COMMUNITY_CREATION_ENABLED.key());
        recovery.export(command); recovery.export(command);
        var order = inOrder(audit, repository);
        order.verify(audit).saveAuditEvent(command.audit());
        order.verify(repository).markAuditExported(command.state().key(), command.commandId());
        order.verify(audit).saveAuditEvent(command.audit());
        order.verify(repository).markAuditExported(command.state().key(), command.commandId());
    }
    @Test void failedAuditNeverAcknowledgesItsDurablePendingEntry() {
        var command = command(SystemSetting.COMMUNITY_CREATION_ENABLED.key());
        doThrow(new IllegalStateException("unavailable")).when(audit).saveAuditEvent(command.audit());
        assertThatThrownBy(() -> recovery.export(command)).isInstanceOf(IllegalStateException.class);
        verify(repository, never()).markAuditExported(any(), any());
    }
    @Test void boundedCursorRotatesKeysAndRevisitsFailedEntriesAfterWrapping() {
        String first = SystemSetting.COMMUNITY_CREATION_ENABLED.key(), second = SystemSetting.COMMUNITY_DEFAULT_MAX_MEMBERS.key();
        var command = command(first);
        when(repository.pending(first, null, 25)).thenReturn(List.of(command));
        when(repository.pending(second, null, 25)).thenReturn(List.of());
        when(repository.pending(first, command.commandId(), 25)).thenReturn(List.of());
        doThrow(new IllegalStateException("unavailable")).when(audit).saveAuditEvent(command.audit());
        for (int run = 0; run < 5; run++) recovery.recover();
        verify(repository, times(2)).pending(first, null, 25);
        verify(repository).pending(first, command.commandId(), 25);
        verify(repository, times(2)).pending(second, null, 25);
        verify(repository, never()).markAuditExported(any(), any());
    }
    private SystemSettingsRepository.Command command(String key) {
        UUID id = UUID.randomUUID(), actor = UUID.randomUUID(); Instant at = Instant.now();
        var state = new SystemSettingsRepository.State(key, "false", id, actor, at);
        var event = new CanonicalRoomAuditEvent(actor, "2026-10", UUID.randomUUID(), "SYSTEM_SETTING_UPDATED",
                "SYSTEM_SETTING", key, null, null, "SUCCESS", "reason", Map.of(), Map.of(), id, null, null, at);
        return new SystemSettingsRepository.Command(id, actor, "hash", state, event);
    }
}
