package com.chatapp.chat_service.canonical.appearance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public record RoomAppearanceRequest(
        @NotBlank @Pattern(regexp = "system|aurora|neon|studio|vapor") String themeId,
        @Size(max = 2048) String customBackgroundUrl,
        UUID backgroundAssetId) {
    public RoomAppearanceRequest(String themeId, String customBackgroundUrl) {
        this(themeId, customBackgroundUrl, null);
    }
}
