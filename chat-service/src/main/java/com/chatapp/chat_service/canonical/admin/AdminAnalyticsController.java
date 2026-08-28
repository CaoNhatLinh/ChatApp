package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/analytics")
public class AdminAnalyticsController {
    private final AdminAnalyticsService analytics;
    private final SecurityContextHelper securityContext;

    public AdminAnalyticsController(AdminAnalyticsService analytics, SecurityContextHelper securityContext) {
        this.analytics = analytics;
        this.securityContext = securityContext;
    }

    @GetMapping
    public List<CanonicalAnalyticsPoint> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "ALL") String eventType,
            @RequestParam(defaultValue = "200") int limit) {
        return analytics.list(securityContext.getCurrentUserId(), from, to, eventType, limit);
    }
}
