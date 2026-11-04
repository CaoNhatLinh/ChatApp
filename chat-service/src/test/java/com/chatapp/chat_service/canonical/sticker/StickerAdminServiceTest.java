package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.appauth.*;
import com.chatapp.chat_service.canonical.media.*;
import com.chatapp.chat_service.common.exception.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.sticker.StickerAdminService.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StickerAdminServiceTest {
    final StickerRepository repository = mock(StickerRepository.class);
    final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    final StickerAuditRecovery recovery = mock(StickerAuditRecovery.class);
    final StickerAdminService service = new StickerAdminService(repository, assets, authorization, recovery,
            new ObjectMapper().findAndRegisterModules());
    final UUID actor = UUID.randomUUID(), packId = UUID.randomUUID(), revision = UUID.randomUUID(), commandId = UUID.randomUUID();

    StickerRepository.Pack pack() {
        return new StickerRepository.Pack(packId, "Expressions", "", null, false, true, revision, Instant.now());
    }
    CreatePack create() { return new CreatePack(commandId, packId, "Expressions", "", null, false, "New pack"); }
    CreateSticker sticker(UUID assetId, boolean active, boolean reviewed) {
        return new CreateSticker(commandId, revision, UUID.randomUUID(), "Wave", assetId, 1, active, reviewed, "New artwork");
    }
    MediaAsset asset(UUID id, UUID owner) {
        return new MediaAsset(id, owner, "CLOUDINARY", "x", "https://example.com/x.webp", "x.webp", "image/webp",
                1000, 128, 128, null, null, "READY", "PENDING", "PENDING", Instant.now(), null);
    }

    @Test void globalPermissionIsCheckedBeforeDataAccess() {
        doThrow(new ForbiddenException("denied")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        assertThatThrownBy(() -> service.createPack(actor, create())).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(repository, assets, recovery);
    }
    @Test void newPackIsDraftAndReplayReturnsSameRevisionAndEvent() {
        final StickerRepository.Command[] saved = new StickerRepository.Command[1];
        when(repository.createPack(any())).thenAnswer(call -> { saved[0] = call.getArgument(0); return true; });
        Result first = service.createPack(actor, create());
        when(repository.findCommand(packId, commandId)).thenAnswer(call -> saved[0]);
        Result second = service.createPack(actor, create());
        assertThat(first.pack().isActive()).isFalse();
        assertThat(second).isEqualTo(first);
        verify(repository, times(1)).createPack(any());
        verify(recovery, times(2)).export(saved[0]);
    }
    @Test void commandCannotBeReusedWithDifferentPayloadOrActor() {
        final StickerRepository.Command[] saved = new StickerRepository.Command[1];
        when(repository.createPack(any())).thenAnswer(call -> { saved[0] = call.getArgument(0); return true; });
        service.createPack(actor, create());
        when(repository.findCommand(packId, commandId)).thenAnswer(call -> saved[0]);
        assertThatThrownBy(() -> service.createPack(actor, new CreatePack(commandId, packId, "Other", "", null, false, "New pack")))
                .isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.createPack(UUID.randomUUID(), create())).isInstanceOf(ConflictException.class);
        verify(repository, times(1)).createPack(any());
    }
    @Test void staleRevisionDoesNotRetainOrWriteAsset() {
        when(repository.findPack(packId)).thenReturn(pack());
        var request = new UpdatePack(commandId, UUID.randomUUID(), "Name", "", UUID.randomUUID(), false, true, true, "Update");
        assertThatThrownBy(() -> service.updatePack(actor, packId, request)).isInstanceOf(ConflictException.class);
        verifyNoInteractions(assets);
        verify(repository, never()).changePack(any(), any());
    }
    @Test void publicationRequiresExplicitHumanArtworkReview() {
        when(repository.findPack(packId)).thenReturn(pack());
        assertThatThrownBy(() -> service.createSticker(actor, packId, sticker(UUID.randomUUID(), true, false)))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(assets);
    }
    @Test void foreignAssetAndDeletionWinnerPreventPublication() {
        when(repository.findPack(packId)).thenReturn(pack());
        UUID id = UUID.randomUUID();
        when(assets.findById(id)).thenReturn(asset(id, UUID.randomUUID()));
        assertThatThrownBy(() -> service.createSticker(actor, packId, sticker(id, true, true))).isInstanceOf(ForbiddenException.class);
        when(assets.findById(id)).thenReturn(asset(id, actor));
        when(assets.retainForHistory(id)).thenReturn(false);
        assertThatThrownBy(() -> service.createSticker(actor, packId, sticker(id, true, true))).isInstanceOf(ConflictException.class);
        verify(repository, never()).changeSticker(any(), any(), any());
    }
    @Test void retainedArtworkAndAuditCommitShareOneCommand() {
        when(repository.findPack(packId)).thenReturn(pack());
        UUID id = UUID.randomUUID();
        when(assets.findById(id)).thenReturn(asset(id, actor));
        when(assets.retainForHistory(id)).thenReturn(true);
        when(repository.changeSticker(any(), eq(revision), isNull())).thenReturn(true);
        Result result = service.createSticker(actor, packId, sticker(id, true, true));
        assertThat(result.pack().revision()).isNotEqualTo(revision);
        assertThat(result.sticker().assetId()).isEqualTo(id);
        var command = org.mockito.ArgumentCaptor.forClass(StickerRepository.Command.class);
        verify(repository).changeSticker(command.capture(), eq(revision), isNull());
        assertThat(command.getValue().audit().requestId()).isEqualTo(commandId);
        assertThat(command.getValue().audit().afterState()).containsEntry("assetId", id.toString());
        verify(recovery).export(command.getValue());
    }
    @Test void failedAuditExportDoesNotLieAboutCommittedMutation() {
        when(repository.createPack(any())).thenReturn(true);
        doThrow(new IllegalStateException("unavailable")).when(recovery).export(any());
        Result result = service.createPack(actor, create());
        assertThat(result.auditPending()).isTrue();
        assertThat(result.pack().stickerPackId()).isEqualTo(packId);
    }
    @Test void failedCasDoesNotExportUncommittedAudit() {
        when(repository.createPack(any())).thenReturn(false);
        assertThatThrownBy(() -> service.createPack(actor, create())).isInstanceOf(ConflictException.class);
        verifyNoInteractions(recovery);
    }
    @Test void disablingBrokenStickerDoesNotDependOnImageAvailability() {
        when(repository.findPack(packId)).thenReturn(pack());
        UUID stickerId = UUID.randomUUID(), assetId = UUID.randomUUID();
        var previous = new StickerRepository.Sticker(stickerId, packId, "Wave", assetId, 1, true, UUID.randomUUID());
        when(repository.findSticker(packId, stickerId)).thenReturn(previous);
        when(repository.changeSticker(any(), eq(revision), eq(previous))).thenReturn(true);
        Result result = service.updateSticker(actor, packId, stickerId, new UpdateSticker(commandId, revision, "Wave", 2, false, false, "Disable"));
        assertThat(result.sticker().isActive()).isFalse();
        assertThat(result.sticker().assetId()).isEqualTo(assetId);
        verifyNoInteractions(assets);
    }
}
