package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/system-settings")
public class SystemSettingsController {
    private final SystemSettingsService service;
    private final SecurityContextHelper security;
    public SystemSettingsController(SystemSettingsService service, SecurityContextHelper security) {
        this.service = service; this.security = security;
    }
    @GetMapping
    public ResponseEntity<List<SystemSettingsService.SettingView>> list() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(security.getCurrentUserId()));
    }
    @PutMapping("/{key}")
    public ResponseEntity<SystemSettingsService.Result> update(@PathVariable String key,
            @Valid @RequestBody SystemSettingsService.Update request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.update(security.getCurrentUserId(), key, request));
    }
}
