package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

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
}
