package com.chatapp.chat_service.canonical.appearance;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record ChatAppearanceRequest(
        @NotBlank @Pattern(regexp = "aurora|neon|studio|vapor") String defaultThemeId,
        @NotBlank @Pattern(regexp = "tiktok|glass|classic") String defaultBubbleStyleId) {
}
