package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminAnalyticsService {
    private static final int MAX_DAYS = 31;
    private static final int MAX_POINTS = 2_000;
    private static final Set<String> EVENT_TYPES = Set.of(
            "ALL", "ROOM_CREATED", "ROOM_JOINED", "MESSAGE_SENT",
            "POLLS_CREATED", "POLL_VOTED", "CALL_STARTED");

    private final CanonicalCqlStore store;
    private final AppAuthorizationService authorization;

    public AdminAnalyticsService(CanonicalCqlStore store, AppAuthorizationService authorization) {
        this.store = store;
        this.authorization = authorization;
    }

    public List<CanonicalAnalyticsPoint> list(
            UUID actorId, LocalDate from, LocalDate to, String requestedEventType, int requestedLimit) {
        authorization.require(actorId, AppPermission.ANALYTICS_READ);
        LocalDate end = to == null ? LocalDate.now(ZoneOffset.UTC) : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (start.isAfter(end) || ChronoUnit.DAYS.between(start, end) > MAX_DAYS - 1L) {
            throw new BadRequestException("analytics range must be between 1 and 31 days");
        }
        String eventType = requestedEventType == null || requestedEventType.isBlank()
                ? "ALL" : requestedEventType.trim().toUpperCase(Locale.ROOT);
        if (!EVENT_TYPES.contains(eventType)) {
            throw new BadRequestException("unsupported analytics event type");
        }
        int limit = Math.max(1, Math.min(MAX_POINTS, requestedLimit));
        List<CanonicalAnalyticsPoint> points = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(end) && points.size() < limit; day = day.plusDays(1)) {
            points.addAll(store.listAnalytics(day, eventType, Math.min(limit - points.size(), MAX_POINTS)));
        }
        return points.stream().limit(limit).toList();
    }
}
