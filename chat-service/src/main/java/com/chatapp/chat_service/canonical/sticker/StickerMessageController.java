package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;

@Validated
@RestController
public class StickerMessageController {
    private final StickerMessageService stickers;
    private final SecurityContextHelper security;
    public StickerMessageController(StickerMessageService stickers, SecurityContextHelper security) {
        this.stickers = stickers;
        this.security = security;
    }
    @GetMapping("/api/conversations/{conversationId}/messages/{messageId}/sticker")
    public ResponseEntity<StickerCatalogService.StickerArtworkView> artwork(@PathVariable UUID conversationId,
            @PathVariable UUID messageId, @RequestParam @Pattern(regexp = "\\d{4}-\\d{2}-\\d{2}-\\d{2}:\\d{2}") String bucket) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(stickers.artwork(security.getCurrentUserId(), conversationId, bucket, messageId));
    }
}
