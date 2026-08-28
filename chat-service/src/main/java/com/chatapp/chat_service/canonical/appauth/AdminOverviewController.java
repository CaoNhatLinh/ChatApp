package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminOverviewController {
    private final AdminOverviewService overview;
    private final SecurityContextHelper securityContext;

    public AdminOverviewController(AdminOverviewService overview, SecurityContextHelper securityContext) {
        this.overview = overview;
        this.securityContext = securityContext;
    }

    @GetMapping("/overview")
    public AdminOverviewService.AdminOverview getOverview() {
        UUID actorId = securityContext.getCurrentUserId();
        return overview.snapshot(actorId);
    }
}
