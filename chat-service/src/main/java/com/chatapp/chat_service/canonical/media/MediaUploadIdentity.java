package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.exception.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

record MediaUploadIdentity(UUID assetId, UUID attachmentId) {
    static MediaUploadIdentity of(UUID ownerId, UUID uploadId) {
        if (ownerId == null || uploadId == null || new UUID(0, 0).equals(uploadId)) {
            throw new BadRequestException("a nonzero uploadId is required");
        }
        String scope = ownerId + ":" + uploadId;
        return new MediaUploadIdentity(id("noi:upload:asset:" + scope), id("noi:upload:attachment:" + scope));
    }
    private static UUID id(String scope) { return UUID.nameUUIDFromBytes(scope.getBytes(StandardCharsets.UTF_8)); }
    String storageKey(UUID ownerId, String mimeType) {
        String suffix = switch (mimeType) {
            case "application/pdf" -> ".pdf";
            case "text/plain" -> ".txt";
            case "application/zip" -> ".zip";
            default -> "";
        };
        return "chatapp/" + ownerId + "/" + assetId + suffix;
    }
}
