package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/audit")
public class AdminAuditController {
    private final AdminAuditService audit;
    private final SecurityContextHelper securityContext;

    public AdminAuditController(AdminAuditService audit, SecurityContextHelper securityContext) {
        this.audit = audit;
        this.securityContext = securityContext;
    }

    @GetMapping
    public List<CanonicalCqlStore.AuditEventRow> list(
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "50") int limit) {
        return audit.list(securityContext.getCurrentUserId(), month, limit);
    }

    @GetMapping(value = "/export", produces = "text/csv")
    public ResponseEntity<byte[]> export(
            @RequestParam(required = false) String month,
            @RequestParam(defaultValue = "200") int limit) {
        String normalizedMonth = month == null || month.isBlank()
                ? YearMonth.now(java.time.ZoneOffset.UTC).toString() : month.trim();
        byte[] body = audit.export(securityContext.getCurrentUserId(), normalizedMonth, limit)
                .getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"noi-audit-" + normalizedMonth + ".csv\"")
                .body(body);
    }
}
