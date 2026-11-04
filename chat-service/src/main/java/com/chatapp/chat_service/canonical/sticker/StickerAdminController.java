package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.sticker.StickerAdminService.*;

@RestController
@RequestMapping("/api/admin/sticker-packs")
public class StickerAdminController {
    private final StickerAdminService service;
    private final SecurityContextHelper security;
    public StickerAdminController(StickerAdminService service, SecurityContextHelper security) {
        this.service = service; this.security = security;
    }
    @PostMapping
    public ResponseEntity<Result> create(@Valid @RequestBody CreatePack request) {
        return response(service.createPack(security.getCurrentUserId(), request));
    }
    @PutMapping("/{packId}")
    public ResponseEntity<Result> update(@PathVariable UUID packId, @Valid @RequestBody UpdatePack request) {
        return response(service.updatePack(security.getCurrentUserId(), packId, request));
    }
    @PostMapping("/{packId}/stickers")
    public ResponseEntity<Result> createSticker(@PathVariable UUID packId, @Valid @RequestBody CreateSticker request) {
        return response(service.createSticker(security.getCurrentUserId(), packId, request));
    }
    @PutMapping("/{packId}/stickers/{stickerId}")
    public ResponseEntity<Result> updateSticker(@PathVariable UUID packId, @PathVariable UUID stickerId,
                                              @Valid @RequestBody UpdateSticker request) {
        return response(service.updateSticker(security.getCurrentUserId(), packId, stickerId, request));
    }
    private ResponseEntity<Result> response(Result result) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(result);
    }
}
