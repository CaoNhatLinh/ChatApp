package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
public class AdminEmailDeliveryController {
    private final AdminEmailDeliveryService service;
    private final SecurityContextHelper security;

    public AdminEmailDeliveryController(AdminEmailDeliveryService service, SecurityContextHelper security) {
        this.service = service;
        this.security = security;
    }

    @GetMapping(value = "/api/admin/email-deliveries/{userId}/{month}/{notificationId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AdminEmailDeliveryService.View> get(
            @PathVariable UUID userId, @PathVariable String month, @PathVariable UUID notificationId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(service.get(security.getCurrentUserId(), userId, month, notificationId));
    }
}
