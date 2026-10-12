package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.media.MediaAsset;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageAttachmentPolicyTest {
    private final MediaAssetRepository assets = mock(MediaAssetRepository.class);
    private final MessageAttachmentPolicy policy = new MessageAttachmentPolicy(assets);
    private final UUID owner = UUID.randomUUID();
    private final UUID assetId = UUID.randomUUID();
    private final AttachmentRequest attachment = new AttachmentRequest(UUID.randomUUID(), assetId,
            "CLOUDINARY", "key", "file.png", "image/png", 10L, null, null, null, null, false);

    private MediaAsset asset(UUID actor, Instant deletedAt) {
        return new MediaAsset(assetId, actor, "CLOUDINARY", "key", "https://res.cloudinary.com/file.png",
                "file.png", "image/png", 10L, null, null, null, "checksum", "READY", "PENDING", "PENDING", Instant.now(), deletedAt);
    }

    @Test void acceptsOnlyCanonicalUploadMetadata() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        assertThatCode(() -> policy.validate(owner, List.of(attachment))).doesNotThrowAnyException();
        var forged = new AttachmentRequest(attachment.attachmentId(), assetId, "CLOUDINARY", "another-key",
                "file.png", "image/png", 10L, null, null, null, null, false);
        assertThatThrownBy(() -> policy.validate(owner, List.of(forged))).isInstanceOf(BadRequestException.class);
    }

    @Test void rejectsAnotherUsersUploadAndDeletedAssets() {
        when(assets.findById(assetId)).thenReturn(asset(UUID.randomUUID(), null), asset(owner, Instant.now()));
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment))).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment))).isInstanceOf(ForbiddenException.class);
    }

    @Test void rejectsDuplicateAttachmentIds() {
        when(assets.findById(assetId)).thenReturn(asset(owner, null));
        assertThatThrownBy(() -> policy.validate(owner, List.of(attachment, attachment))).isInstanceOf(BadRequestException.class);
    }
}
