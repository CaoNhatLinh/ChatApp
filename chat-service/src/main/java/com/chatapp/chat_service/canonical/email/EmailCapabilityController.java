package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class EmailCapabilityController {
    private final ResendSettings settings;
    private final UserRepository users;
    private final EmailDeliveryRepository deliveries;
    private final SecurityContextHelper security;

    public EmailCapabilityController(ResendSettings settings, UserRepository users,
                                     EmailDeliveryRepository deliveries, SecurityContextHelper security) {
        this.settings = settings;
        this.users = users;
        this.deliveries = deliveries;
        this.security = security;
    }
    @GetMapping("/api/notifications/channels")
    public ResponseEntity<Channels> channels() {
        var user = users.findById(security.getCurrentUserId());
        boolean available = settings.enabled && user != null && "ACTIVE".equals(user.accountStatus())
                && settings.allows(user.email()) && !deliveries.suppressed(user.email());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Channels(
                available, "ALLOWLIST", !settings.webhookSecret.isBlank()));
    }
    public record Channels(boolean emailAvailable, String emailMode, boolean webhookConfigured) { }
}
