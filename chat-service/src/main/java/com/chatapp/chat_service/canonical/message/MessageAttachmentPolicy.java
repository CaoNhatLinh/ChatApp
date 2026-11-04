package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.AttachmentRequest;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.media.MediaThumbnail;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.springframework.stereotype.Component;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Component
public class MessageAttachmentPolicy {
    private final MediaAssetRepository assets;

    public MessageAttachmentPolicy(MediaAssetRepository assets) { this.assets = assets; }

    public void validate(UUID actorId, List<AttachmentRequest> attachments) {
        validateAssets(actorId, attachments);
    }

    /** Only call after matching every attachment to an authorized forward source. */
    public void validateForwarded(List<AttachmentRequest> attachments) {
        validateAssets(null, attachments);
    }

    /** Call only for validated attachments, before publishing their first durable message reference. */
    public void retainForHistory(List<AttachmentRequest> attachments) {
        if (attachments == null) return;
        var retained = new HashSet<UUID>();
        for (var attachment : attachments) {
            UUID assetId = attachment.assetId();
            if (retained.add(assetId) && !assets.retainForHistory(assetId)) {
                throw new ConflictException("attachment is being deleted or is no longer available");
            }
        }
    }

    private void validateAssets(UUID ownerId, List<AttachmentRequest> attachments) {
        if (attachments == null) return;
        var ids = new HashSet<UUID>();
        for (AttachmentRequest attachment : attachments) {
            if (attachment == null || attachment.attachmentId() == null || attachment.assetId() == null
                    || !ids.add(attachment.attachmentId())) {
                throw new BadRequestException("attachments require unique attachmentId and assetId");
            }
            var asset = assets.findById(attachment.assetId());
            if (asset == null || (ownerId != null && !ownerId.equals(asset.ownerId())) || asset.deletedAt() != null
                    || !"READY".equals(asset.uploadStatus())) {
                throw new ForbiddenException("attachment must reference an authorized ready, active upload");
            }
            if (!Objects.equals(asset.storageProvider(), attachment.storageProvider())
                    || !Objects.equals(asset.storageKey(), attachment.storageKey())
                    || !Objects.equals(asset.fileName(), attachment.fileName())
                    || !Objects.equals(asset.mimeType(), attachment.mimeType())
                    || !Objects.equals(asset.byteSize(), attachment.byteSize())
                    || !Objects.equals(asset.width(), attachment.width())
                    || !Objects.equals(asset.height(), attachment.height())
                    || !Objects.equals(asset.durationMs(), attachment.durationMs())) {
                throw new BadRequestException("attachment metadata does not match the uploaded asset");
            }
            if (attachment.thumbnailUrl() != null && assets.findThumbnails(attachment.assetId()).stream()
                    .noneMatch(thumbnail -> thumbnail.status() == MediaThumbnail.Status.READY
                            && attachment.thumbnailUrl().equals(thumbnail.url()))) {
                throw new BadRequestException("attachment thumbnail does not match a ready variant of the uploaded asset");
            }
        }
    }
}
