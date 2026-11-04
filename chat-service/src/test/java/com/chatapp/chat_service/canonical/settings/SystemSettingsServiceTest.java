package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.appauth.*;
import com.chatapp.chat_service.common.exception.*;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import com.fasterxml.jackson.databind.node.BooleanNode;
import com.fasterxml.jackson.databind.node.TextNode;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class SystemSettingsServiceTest {
    private final SystemSettingsRepository repository = mock(SystemSettingsRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final SystemSettingsAuditRecovery recovery = mock(SystemSettingsAuditRecovery.class);
    private final SystemSettingsService service = new SystemSettingsService(repository, authorization, recovery);
    private final UUID actor = UUID.randomUUID();

    @Test void pristineCatalogIsFiniteTypedAndNotTimestampVersioned() {
        var entries = service.list(actor);
        assertThat(entries).hasSize(2);
        assertThat(entries.get(0).revision()).isEqualTo(SystemSettingsRepository.PRISTINE_REVISION);
        assertThat(entries.get(0).value().booleanValue()).isTrue();
        assertThat(entries.get(0).updatedAt()).isNull();
        assertThat(entries.get(1).value().intValue()).isEqualTo(10000);
        verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
    }
    @Test void unauthorizedReadNeverTouchesStorage() {
        doThrow(new ForbiddenException("forbidden")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> service.list(actor)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository);
    }
    @Test void actualRuntimeConsumerReadsConfiguredValuesAndDoesNotMaskCorruption() {
        when(repository.find("community.creationEnabled")).thenReturn(new SystemSettingsRepository.State(
                "community.creationEnabled", "false", UUID.randomUUID(), actor, Instant.now()));
        when(repository.find("community.defaultMaxMembers")).thenReturn(new SystemSettingsRepository.State(
                "community.defaultMaxMembers", "250", UUID.randomUUID(), actor, Instant.now()));
        var defaults = service.communityDefaults();
        assertThat(defaults.creationEnabled()).isFalse();
        assertThat(defaults.defaultMaxMembers()).isEqualTo(250);
        when(repository.find("community.defaultMaxMembers")).thenReturn(new SystemSettingsRepository.State(
                "community.defaultMaxMembers", "bad", UUID.randomUUID(), actor, Instant.now()));
        assertThatThrownBy(service::communityDefaults).isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(authorization);
    }
    @Test void committedUpdateIncludesImmutableAuditAndReturnsCurrentAuthorityOnExactReplay() {
        var current = new AtomicReference<SystemSettingsRepository.State>();
        var committed = new AtomicReference<SystemSettingsRepository.Command>();
        String key = "community.creationEnabled";
        when(repository.find(key)).thenAnswer(call -> current.get());
        when(repository.findCommand(eq(key), any())).thenAnswer(call -> committed.get());
        when(repository.save(any(), eq(SystemSettingsRepository.PRISTINE_REVISION))).thenAnswer(call -> {
            SystemSettingsRepository.Command command = call.getArgument(0);
            committed.set(command); current.set(command.state()); return true;
        });
        UUID commandId = UUID.randomUUID();
        var request = new SystemSettingsService.Update(commandId, SystemSettingsRepository.PRISTINE_REVISION, BooleanNode.FALSE, "  Pause new communities  ");
        var result = service.update(actor, key, request);
        assertThat(result.setting().value().booleanValue()).isFalse();
        assertThat(result.setting().revision()).isEqualTo(commandId);
        assertThat(committed.get().audit().reasonCode()).isEqualTo("Pause new communities");
        assertThat(committed.get().audit().beforeState().get("value")).isEqualTo("true");
        assertThat(committed.get().audit().afterState().get("value")).isEqualTo("false");
        assertThat(committed.get().audit().requestId()).isEqualTo(commandId);
        var newer = new SystemSettingsRepository.State(key, "true", UUID.randomUUID(), actor, Instant.now());
        current.set(newer);
        assertThat(service.update(actor, key, request).setting().revision()).isEqualTo(newer.revision());
        verify(repository, times(1)).save(any(), any());
        verify(recovery, times(2)).export(committed.get());
    }
    @Test void staleRevisionAndLosingCasDoNotCreateSuccessAudit() {
        var request = new SystemSettingsService.Update(UUID.randomUUID(), UUID.randomUUID(), BooleanNode.FALSE, "reason");
        assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", request)).isInstanceOf(ConflictException.class);
        verify(repository, never()).save(any(), any());
        assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", update(BooleanNode.FALSE, "reason")))
                .isInstanceOf(ConflictException.class);
        verifyNoInteractions(recovery);
    }
    @Test void validationAndForbiddenMutationsNeverReserveACommand() {
        for (var request : new SystemSettingsService.Update[]{update(TextNode.valueOf("false"), "reason"),
                update(BooleanNode.FALSE, " "), new SystemSettingsService.Update(SystemSettingsRepository.PRISTINE_REVISION,
                        SystemSettingsRepository.PRISTINE_REVISION, BooleanNode.FALSE, "reason")}) {
            assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", request)).isInstanceOf(BadRequestException.class);
        }
        doThrow(new ForbiddenException("forbidden")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", update(BooleanNode.FALSE, "reason")))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository, recovery);
    }
    @Test void auditExportFailureDoesNotUndoCommittedSettingOrHidePendingState() {
        when(repository.save(any(), any())).thenAnswer(call -> {
            SystemSettingsRepository.Command command = call.getArgument(0);
            when(repository.find(command.state().key())).thenReturn(command.state()); return true;
        });
        doThrow(new IllegalStateException("audit unavailable")).when(recovery).export(any());
        var result = service.update(actor, "community.creationEnabled", update(BooleanNode.FALSE, "reason"));
        assertThat(result.auditPending()).isTrue();
        assertThat(result.setting().value().booleanValue()).isFalse();
    }
    @Test void reusedCommandCannotChangePayloadOrActor() {
        var saved = new AtomicReference<SystemSettingsRepository.Command>();
        when(repository.save(any(), any())).thenAnswer(call -> {
            SystemSettingsRepository.Command command = call.getArgument(0);
            saved.set(command); when(repository.find(command.state().key())).thenReturn(command.state()); return true;
        });
        var request = update(BooleanNode.FALSE, "reason");
        service.update(actor, "community.creationEnabled", request);
        when(repository.findCommand("community.creationEnabled", request.commandId())).thenReturn(saved.get());
        assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", new SystemSettingsService.Update(
                request.commandId(), request.expectedRevision(), BooleanNode.TRUE, "reason"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.update(UUID.randomUUID(), "community.creationEnabled", request)).isInstanceOf(ConflictException.class);
        verify(repository, times(1)).save(any(), any());
    }
    @Test void committedCommandWithoutStateCannotMasqueradeAsPristineDefaults() {
        when(repository.save(any(), any())).thenReturn(true);
        assertThatThrownBy(() -> service.update(actor, "community.creationEnabled", update(BooleanNode.FALSE, "reason")))
                .isInstanceOf(IllegalStateException.class);
    }
    private SystemSettingsService.Update update(com.fasterxml.jackson.databind.JsonNode value, String reason) {
        return new SystemSettingsService.Update(UUID.randomUUID(), SystemSettingsRepository.PRISTINE_REVISION, value, reason);
    }
}
