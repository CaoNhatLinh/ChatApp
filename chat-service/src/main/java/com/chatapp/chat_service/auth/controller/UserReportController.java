package com.chatapp.chat_service.auth.controller;

import com.chatapp.chat_service.auth.entity.UserReport;
import com.chatapp.chat_service.auth.service.UserReportService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class UserReportController {

    private final UserReportService userReportService;
    private final SecurityContextHelper securityContextHelper;

    /**
     * Report a user
     */
    @PostMapping
    public ResponseEntity<UserReport> reportUser(
            @RequestParam UUID reportedUserId,
            @RequestParam String reason,
            @RequestParam(required = false) String description) {

        UUID reporterId = securityContextHelper.getCurrentUserId();
        if (reporterId == null) {
            return ResponseEntity.status(401).build();
        }

        UserReport report = userReportService.reportUser(reporterId, reportedUserId, reason, description);
        return ResponseEntity.ok(report);
    }

    /**
     * Get reports for a specific user
     */
    @GetMapping("/user/{reportedUserId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserReport>> getReportsForUser(@PathVariable UUID reportedUserId) {
        List<UserReport> reports = userReportService.getReportsForUser(reportedUserId);
        return ResponseEntity.ok(reports);
    }

    /**
     * Get all pending reports (admin only)
     */
    @GetMapping("/pending")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserReport>> getPendingReports() {
        List<UserReport> reports = userReportService.getPendingReports();
        return ResponseEntity.ok(reports);
    }

    /**
     * Get reports by status (admin only)
     */
    @GetMapping("/status/{status}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserReport>> getReportsByStatus(@PathVariable String status) {
        List<UserReport> reports = userReportService.getReportsByStatus(status);
        return ResponseEntity.ok(reports);
    }

    /**
     * Review a report (admin only)
     */
    @PostMapping("/{reportId}/review")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> reviewReport(
            @PathVariable UUID reportId,
            @RequestParam String status,
            @RequestParam(required = false) String resolutionNote) {

        UUID adminId = securityContextHelper.getCurrentUserId();
        if (adminId == null) {
            return ResponseEntity.status(401).build();
        }

        userReportService.reviewReport(reportId, adminId, status, resolutionNote);
        return ResponseEntity.ok().build();
    }
}
