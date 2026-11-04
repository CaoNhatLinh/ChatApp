package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AdminEmailDeliveryService {
    private final AppAuthorizationService authorization;
    private final EmailDeliveryRepository deliveries;

    public AdminEmailDeliveryService(AppAuthorizationService authorization, EmailDeliveryRepository deliveries) {
        this.authorization = authorization;
        this.deliveries = deliveries;
    }

    public View get(UUID actor, UUID userId, String month, UUID notificationId) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        EmailHistoryService.validateMonth(month);
        if (notificationId.version() != 1) throw new BadRequestException("notificationId must be a timeuuid");

        var delivery = deliveries.find(new EmailDeliveryRepository.Key(userId, month, notificationId));
        if (delivery == null) throw new NotFoundException("Email delivery not found");
        return new View(EmailHistoryService.Status.safe(delivery.status()), delivery.attempts(),
                delivery.attemptedAt(), delivery.retryAt(), delivery.deliveredAt(), delivery.reviewedAt());
    }

    public record View(EmailHistoryService.Status status, int attempts, Instant attemptedAt,
                       Instant retryAt, Instant deliveredAt, Instant reviewedAt) {}
}
