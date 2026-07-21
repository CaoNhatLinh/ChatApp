package com.chatapp.chat_service.common.audit;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final SecurityContextHelper securityContextHelper;

    public void logAction(String action, String resourceType, String resourceId, String details, String status) {
        try {
            UUID userId = securityContextHelper.getCurrentUserId();
            String username = getCurrentUsername();

            HttpServletRequest request = getCurrentRequest();
            String ipAddress = request != null ? getClientIpAddress(request) : null;
            String userAgent = request != null ? request.getHeader("User-Agent") : null;

            AuditLog auditLog = AuditLog.builder()
                    .id(Uuids.timeBased())
                    .userId(userId)
                    .username(username)
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .details(details)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .timestamp(Instant.now())
                    .status(status)
                    .build();

            auditLogRepository.save(auditLog);
            log.debug("Audit log created: {} by user {} on resource {}/{}", action, username, resourceType, resourceId);
        } catch (Exception e) {
            log.error("Failed to create audit log for action {}: {}", action, e.getMessage());
        }
    }

    public void logSuccess(String action, String resourceType, String resourceId, String details) {
        logAction(action, resourceType, resourceId, details, "SUCCESS");
    }

    public void logFailure(String action, String resourceType, String resourceId, String details) {
        logAction(action, resourceType, resourceId, details, "FAILURE");
    }

    private String getCurrentUsername() {
        try {
            UUID userId = securityContextHelper.getCurrentUserId();
            return userId != null ? userId.toString() : "anonymous";
        } catch (Exception e) {
            return "anonymous";
        }
    }

    private HttpServletRequest getCurrentRequest() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attributes != null ? attributes.getRequest() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }
}
