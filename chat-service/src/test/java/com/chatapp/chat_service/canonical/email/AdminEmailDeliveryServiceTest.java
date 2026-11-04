package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminEmailDeliveryServiceTest {
    private static final String MONTH = "2026-11";
    private static final Instant NOTIFICATION_TIME = Instant.parse("2026-10-31T23:59:59Z");
    private final UUID actor = UUID.randomUUID();
    private final UUID recipient = UUID.randomUUID();
    private final UUID notification = Uuids.startOf(NOTIFICATION_TIME.toEpochMilli());
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final EmailDeliveryRepository repository = mock(EmailDeliveryRepository.class);
    private final AdminEmailDeliveryService service = new AdminEmailDeliveryService(authorization, repository);
    private final EmailDeliveryRepository.Key key = new EmailDeliveryRepository.Key(recipient, MONTH, notification);

    @Test
    void requiresSystemOperateBeforeValidationOrLookup() {
        var denied = new ForbiddenException("Missing permission");
        doThrow(denied).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);

        assertThatThrownBy(() -> service.get(actor, recipient, "invalid", UUID.randomUUID()))
                .isSameAs(denied);
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsMalformedMonthAndNonTimeUuidBeforeLookup() {
        assertThatThrownBy(() -> service.get(actor, recipient, "2026-1", notification))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.get(actor, recipient, MONTH, UUID.randomUUID()))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void missingExactLedgerRowReturnsNotFound() {
        assertThatThrownBy(() -> service.get(actor, recipient, MONTH, notification))
                .isInstanceOf(NotFoundException.class);
        verify(repository).find(key);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void usesWriteMonthForOlderEventIdAndReturnsRedactedOperationalFields() throws Exception {
        Instant attemptedAt = NOTIFICATION_TIME.plusSeconds(2);
        Instant retryAt = attemptedAt.plusSeconds(5);
        when(repository.find(key)).thenReturn(new EmailDeliveryRepository.Delivery(
                key, "RETRY", "private-provider-id", "private-request-payload", attemptedAt,
                attemptedAt.plusSeconds(60), retryAt, 3, UUID.randomUUID(), null, "private-failure-code"));

        var response = service.get(actor, recipient, MONTH, notification);
        var mapper = new JacksonConfig().objectMapper();
        var json = mapper.readTree(mapper.writeValueAsString(response));
        assertThat(json.path("status").asText()).isEqualTo("RETRY");
        assertThat(json.path("attempts").asInt()).isEqualTo(3);
        assertThat(json.path("attemptedAt").asText()).isEqualTo(attemptedAt.toString());
        assertThat(json.path("retryAt").asText()).isEqualTo(retryAt.toString());
        assertThat(json.path("deliveredAt").isNull()).isTrue();
        assertThat(json.toString()).doesNotContain(
                "private-provider-id", "private-request-payload", "private-failure-code");
        assertThat(json.has("leaseUntil")).isFalse();
        assertThat(json.has("revision")).isFalse();

        var ordered = inOrder(authorization, repository);
        ordered.verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        ordered.verify(repository).find(key);
        verifyNoMoreInteractions(repository);
    }
}
