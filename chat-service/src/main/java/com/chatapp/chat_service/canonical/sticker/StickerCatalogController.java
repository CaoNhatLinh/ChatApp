package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.sticker.StickerCatalogService.*;

@RestController
public class StickerCatalogController {
    private final StickerCatalogService catalog;
    private final SecurityContextHelper security;
    public StickerCatalogController(StickerCatalogService catalog, SecurityContextHelper security) {
        this.catalog = catalog;
        this.security = security;
    }
    @GetMapping("/api/sticker-packs")
    public ResponseEntity<Page<PackView>> packs(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "25") int limit) {
        return response(catalog.packs(security.getCurrentUserId(), false, cursor, limit));
    }
    @GetMapping("/api/sticker-packs/{packId}/stickers")
    public ResponseEntity<Page<StickerView>> stickers(@PathVariable UUID packId, @RequestParam(required = false) String cursor,
                                                    @RequestParam(defaultValue = "25") int limit) {
        return response(catalog.stickers(security.getCurrentUserId(), false, packId, cursor, limit));
    }
    @GetMapping("/api/admin/sticker-packs")
    public ResponseEntity<Page<PackView>> adminPacks(@RequestParam(required = false) String cursor, @RequestParam(defaultValue = "25") int limit) {
        return response(catalog.packs(security.getCurrentUserId(), true, cursor, limit));
    }
    @GetMapping("/api/admin/sticker-packs/{packId}/stickers")
    public ResponseEntity<Page<StickerView>> adminStickers(@PathVariable UUID packId, @RequestParam(required = false) String cursor,
                                                         @RequestParam(defaultValue = "25") int limit) {
        return response(catalog.stickers(security.getCurrentUserId(), true, packId, cursor, limit));
    }
    @GetMapping("/api/admin/sticker-packs/{packId}")
    public ResponseEntity<PackView> adminPack(@PathVariable UUID packId) {
        return response(catalog.adminPack(security.getCurrentUserId(), packId));
    }
    @GetMapping("/api/admin/sticker-packs/{packId}/stickers/{stickerId}")
    public ResponseEntity<AdminStickerView> adminSticker(@PathVariable UUID packId, @PathVariable UUID stickerId) {
        return response(catalog.adminSticker(security.getCurrentUserId(), packId, stickerId));
    }
    private <T> ResponseEntity<T> response(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
