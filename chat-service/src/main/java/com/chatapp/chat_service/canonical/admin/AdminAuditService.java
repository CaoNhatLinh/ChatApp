package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminAuditService {
    private final CanonicalCqlStore store;
    private final AppAuthorizationService authorization;

    public AdminAuditService(CanonicalCqlStore store, AppAuthorizationService authorization) {
        this.store = store;
        this.authorization = authorization;
    }

    public List<CanonicalCqlStore.AuditEventRow> list(UUID actorId, String month, int limit) {
        authorization.require(actorId, AppPermission.AUDIT_READ);
        String normalizedMonth = month == null || month.isBlank()
                ? YearMonth.now(java.time.ZoneOffset.UTC).toString() : month.trim();
        try {
            YearMonth.parse(normalizedMonth);
        } catch (DateTimeParseException exception) {
            throw new BadRequestException("month must use YYYY-MM format");
        }
        return store.listAuditEvents(normalizedMonth, Math.max(1, Math.min(limit, 200)));
    }

    public String export(UUID actorId, String month, int limit) {
        List<CanonicalCqlStore.AuditEventRow> events = list(actorId, month, limit);
        StringBuilder csv = new StringBuilder()
                .append("eventMonth,eventId,action,resourceType,resourceId,actorId,conversationId,targetUserId,")
                .append("outcome,reasonCode,requestId,createdAt,beforeState,afterState\n");
        for (CanonicalCqlStore.AuditEventRow event : events) {
            appendRow(csv,
                    event.eventMonth(), event.eventId(), event.action(), event.resourceType(), event.resourceId(),
                    event.actorId(), event.conversationId(), event.targetUserId(), event.outcome(), event.reasonCode(),
                    event.requestId(), event.createdAt(), state(event.beforeState()), state(event.afterState()));
        }
        return csv.toString();
    }

    private static void appendRow(StringBuilder csv, Object... values) {
        for (int index = 0; index < values.length; index++) {
            if (index > 0) csv.append(',');
            csv.append(csvValue(values[index]));
        }
        csv.append('\n');
    }

    private static String csvValue(Object value) {
        if (value == null) return "";
        return '"' + String.valueOf(value).replace("\"", "\"\"").replace("\r", "\\r").replace("\n", "\\n") + '"';
    }

    private static String state(Map<String, String> values) {
        if (values == null || values.isEmpty()) return "";
        return values.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining(";"));
    }
}
