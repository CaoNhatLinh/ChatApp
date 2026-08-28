package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminModerationController {
    private final AdminModerationService moderation;
    private final SecurityContextHelper securityContext;

    public AdminModerationController(AdminModerationService moderation, SecurityContextHelper securityContext) {
        this.moderation = moderation;
        this.securityContext = securityContext;
    }

    @GetMapping("/reports")
    public List<ModerationRepository.ReportRow> listReports(
            @RequestParam(defaultValue = "OPEN") String status,
            @RequestParam(required = false) String day,
            @RequestParam(defaultValue = "50") int limit) {
        return moderation.listReports(actorId(), status, day, limit);
    }

    @PutMapping("/reports/{reportId}")
    public ModerationRepository.ReportRow resolveReport(
            @PathVariable UUID reportId,
            @RequestBody AdminModerationService.ResolveReportRequest request) {
        return moderation.resolveReport(actorId(), reportId, request);
    }

    @GetMapping("/users/{userId}/sanctions")
    public List<ModerationRepository.SanctionRow> listSanctions(
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "50") int limit) {
        return moderation.listSanctions(actorId(), userId, limit);
    }

    @PostMapping("/sanctions")
    public ModerationRepository.SanctionRow imposeSanction(
            @RequestBody AdminModerationService.SanctionRequest request) {
        return moderation.imposeSanction(actorId(), request);
    }

    @DeleteMapping("/users/{userId}/sanctions/{sanctionId}")
    public ModerationRepository.SanctionRow revokeSanction(
            @PathVariable UUID userId,
            @PathVariable UUID sanctionId,
            @RequestParam UUID imposedAt,
            @RequestParam String reason) {
        return moderation.revokeSanction(actorId(), userId, imposedAt, sanctionId, reason);
    }

    private UUID actorId() {
        return securityContext.getCurrentUserId();
    }
}
