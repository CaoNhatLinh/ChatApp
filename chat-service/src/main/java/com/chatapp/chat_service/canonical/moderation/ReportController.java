package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reports")
public class ReportController {
    private final ReportService reports;
    private final SecurityContextHelper securityContext;

    public ReportController(ReportService reports, SecurityContextHelper securityContext) {
        this.reports = reports;
        this.securityContext = securityContext;
    }

    @PostMapping
    public ResponseEntity<ModerationRepository.ReportRow> create(
            @RequestBody ReportService.CreateReportRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reports.create(securityContext.getCurrentUserId(), request, clientReportId(idempotencyKey)));
    }

    private UUID clientReportId(String header) {
        if (header == null) return null;
        try {
            UUID id = UUID.fromString(header);
            if (id.toString().equalsIgnoreCase(header)) return id;
        } catch (IllegalArgumentException invalid) {
            throw new BadRequestException("Idempotency-Key must be a UUID");
        }
        throw new BadRequestException("Idempotency-Key must be a UUID");
    }

    @GetMapping("/mine")
    public List<ModerationRepository.ReportRow> mine(@RequestParam(defaultValue = "50") int limit) {
        return reports.listMine(securityContext.getCurrentUserId(), limit);
    }
}
