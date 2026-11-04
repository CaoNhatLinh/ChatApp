package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminEmailReviewDispositionServiceTest {
    private static final String MONTH = "2026-11";
    private static final String REASON = "Confirmed provider history";
    private static final Instant REVIEWED_AT = Instant.parse("2026-11-03T01:02:03Z");
    private final UUID actor = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();
    private final UUID notification = Uuids.startOf(Instant.parse("2026-10-31T23:59:59Z").toEpochMilli());
    private final UUID command = UUID.randomUUID();
    private final EmailDeliveryRepository.Key key = new EmailDeliveryRepository.Key(user, MONTH, notification);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final EmailReviewDispositionRepository repository = mock(EmailReviewDispositionRepository.class);
    private final AdminEmailReviewDispositionService service = new AdminEmailReviewDispositionService(authorization, repository);

    @Test
    void checksOperatorPermissionBeforeValidatingOrReading() {
        var denied = new ForbiddenException("Missing permission");
        doThrow(denied).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);

        assertThatThrownBy(() -> service.close(actor, user, "invalid", notification, null)).isSameAs(denied);
        verifyNoInteractions(repository);
    }

    @Test
    void rejectsInvalidKeysAndCommandsBeforeReading() {
        assertThatThrownBy(() -> service.close(actor, user, "2026-1", notification, request(command, REASON)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.close(actor, user, MONTH, UUID.randomUUID(), request(command, REASON)))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> close(request(notification, REASON))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> close(request(null, REASON))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> close(request(command, "  \t"))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> close(request(command, "x".repeat(301)))).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void missingDeliveryReturnsNotFound() {
        assertThatThrownBy(() -> close(request(command, REASON))).isInstanceOf(NotFoundException.class);
        verify(repository).find(key);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void successfulCloseRecordsNormalizedReasonAndSignedActorOnExactKey() {
        when(repository.find(key)).thenReturn(openReview());
        when(repository.close(eq(key), any())).thenReturn(true);

        var result = close(request(command, " " + REASON + " "));

        var receipt = ArgumentCaptor.forClass(EmailReviewDispositionRepository.Receipt.class);
        var ordered = inOrder(authorization, repository);
        ordered.verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        ordered.verify(repository).find(key);
        ordered.verify(repository).close(eq(key), receipt.capture());
        assertThat(receipt.getValue().commandId()).isEqualTo(command);
        assertThat(receipt.getValue().actorId()).isEqualTo(actor);
        assertThat(receipt.getValue().reason()).isEqualTo(REASON);
        assertThat(result.reviewedAt()).isNotNull().isEqualTo(receipt.getValue().reviewedAt());
    }

    @Test
    void exactReplayReturnsOriginalReceiptAfterProviderStateAdvances() {
        when(repository.find(key)).thenReturn(new EmailReviewDispositionRepository.State("DELIVERED", receipt(actor)));

        assertThat(close(request(command, " " + REASON + " ")).reviewedAt()).isEqualTo(REVIEWED_AT);
        verify(repository, never()).close(any(), any());
    }

    @Test
    void rejectsDifferentActorCommandOrReasonAndNonReviewState() {
        when(repository.find(key)).thenReturn(
                new EmailReviewDispositionRepository.State("REVIEW_REQUIRED", receipt(UUID.randomUUID())),
                new EmailReviewDispositionRepository.State("REVIEW_REQUIRED", receipt(actor)),
                new EmailReviewDispositionRepository.State("REVIEW_REQUIRED", receipt(actor)),
                new EmailReviewDispositionRepository.State("DELIVERED", null));

        assertThatThrownBy(() -> close(request(command, REASON))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> close(request(UUID.randomUUID(), REASON))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> close(request(command, "Different reason"))).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> close(request(command, REASON))).isInstanceOf(ConflictException.class);
        verify(repository, never()).close(any(), any());
    }

    @Test
    void lostCasReturnsWinningMatchingReceipt() {
        when(repository.find(key)).thenReturn(openReview(),
                new EmailReviewDispositionRepository.State("DELIVERED", receipt(actor)));

        assertThat(close(request(command, REASON)).reviewedAt()).isEqualTo(REVIEWED_AT);
        var ordered = inOrder(repository);
        ordered.verify(repository).find(key);
        ordered.verify(repository).close(eq(key), any());
        ordered.verify(repository).find(key);
    }

    @Test
    void lostCasToProviderEventConflictsWithoutTryingAnotherWrite() {
        when(repository.find(key)).thenReturn(openReview(), new EmailReviewDispositionRepository.State("DELIVERED", null));

        assertThatThrownBy(() -> close(request(command, REASON))).isInstanceOf(ConflictException.class);
        verify(repository, times(2)).find(key);
        verify(repository).close(eq(key), any());
        verifyNoMoreInteractions(repository);
    }

    private AdminEmailReviewDispositionService.Result close(AdminEmailReviewDispositionService.Request request) {
        return service.close(actor, user, MONTH, notification, request);
    }

    private static AdminEmailReviewDispositionService.Request request(UUID commandId, String reason) {
        return new AdminEmailReviewDispositionService.Request(commandId, reason);
    }

    private EmailReviewDispositionRepository.Receipt receipt(UUID reviewer) {
        return new EmailReviewDispositionRepository.Receipt(command, reviewer, REASON, REVIEWED_AT);
    }

    private static EmailReviewDispositionRepository.State openReview() {
        return new EmailReviewDispositionRepository.State("REVIEW_REQUIRED", null);
    }
}
