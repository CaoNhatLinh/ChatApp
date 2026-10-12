package com.chatapp.chat_service.canonical.analytics;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAnalyticsPoint;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import java.time.LocalDate;
import java.util.List;

public interface AnalyticsRepository {
    void record(CanonicalRoomAuditEvent event);
    List<CanonicalAnalyticsPoint> find(LocalDate day, String eventType, int limit);
}
