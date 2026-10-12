package com.chatapp.chat_service.canonical.appearance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RoomAppearanceRequest(
        @NotBlank @Pattern(regexp = "aurora|neon|studio|vapor") String themeId,
        @Size(max = 2048) String customBackgroundUrl) {
}
