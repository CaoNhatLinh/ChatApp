package com.chatapp.chat_service.canonical.email;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AdminEmailReviewServiceTest {
    private static final LocalDate DAY = LocalDate.parse("2026-11-03");
    private final UUID actor = UUID.randomUUID();
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final EmailReviewRepository repository = mock(EmailReviewRepository.class);
    private final AdminEmailReviewService service = new AdminEmailReviewService(authorization, repository);

    @Test
    void filteredEmptyPageContinuesFromLastScannedCandidate() {
        var first = candidate();
        var lastScanned = candidate();
        var lookahead = candidate();
        Instant attemptedAt = Instant.parse("2026-11-03T02:30:00Z");
        when(repository.list(DAY, null, 3)).thenReturn(List.of(first, lastScanned, lookahead));
        when(repository.list(DAY, lastScanned, 3)).thenReturn(List.of(lookahead));
        when(repository.findAll(List.of(first.key(), lastScanned.key()))).thenReturn(Map.of());
        when(repository.findAll(List.of(lookahead.key())))
                .thenReturn(Map.of(lookahead.key(), new EmailReviewRepository.Review(3, attemptedAt)));

        var initial = service.list(actor, DAY.toString(), null, 2);
        assertThat(initial.content()).isEmpty();
        assertThat(initial.hasNext()).isTrue();
        assertThat(initial.nextCursor()).isNotBlank();
        verify(repository, never()).findAll(List.of(lookahead.key()));

        var next = service.list(actor, DAY.toString(), initial.nextCursor(), 2);
        var key = lookahead.key();
        assertThat(next.content()).containsExactly(new AdminEmailReviewService.Item(
                key.userId(), key.month(), key.notificationId(), 3, attemptedAt));
        assertThat(next.hasNext()).isFalse();
        assertThat(next.nextCursor()).isNull();

        var ordered = inOrder(authorization, repository);
        ordered.verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        ordered.verify(repository).list(DAY, null, 3);
        ordered.verify(repository).findAll(List.of(first.key(), lastScanned.key()));
        ordered.verify(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        ordered.verify(repository).list(DAY, lastScanned, 3);
        ordered.verify(repository).findAll(List.of(lookahead.key()));
    }

    @Test
    void requiresSystemOperateBeforeReadingCandidates() {
        var denied = new ForbiddenException("Missing permission");
        doThrow(denied).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);

        assertThatThrownBy(() -> service.list(actor, DAY.toString(), null, 20)).isSameAs(denied);
        verifyNoInteractions(repository);
    }

    @Test
    void cursorCannotBeUsedWithAnotherDay() {
        when(repository.list(DAY, null, 2)).thenReturn(List.of(candidate(), candidate()));
        String cursor = service.list(actor, DAY.toString(), null, 1).nextCursor();
        clearInvocations(repository);

        assertThatThrownBy(() -> service.list(actor, DAY.plusDays(1).toString(), cursor, 1))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void malformedInputsDoNotReachTheRepository() {
        assertThatThrownBy(() -> service.list(actor, "2026-02-30", null, 20))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.list(actor, DAY.toString(), "%invalid", 20))
                .isInstanceOf(BadRequestException.class);
        for (int limit : List.of(0, 51)) {
            assertThatThrownBy(() -> service.list(actor, DAY.toString(), null, limit))
                    .isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(repository);
    }

    @Test
    void defaultsToUtcDayAndBoundsTheCandidateWindow() {
        var queriedDay = ArgumentCaptor.forClass(LocalDate.class);
        when(repository.list(any(LocalDate.class), isNull(), eq(51))).thenReturn(List.of());
        LocalDate before = LocalDate.now(ZoneOffset.UTC);

        var page = service.list(actor, null, null, 50);

        assertThat(page.content()).isEmpty();
        assertThat(page.hasNext()).isFalse();
        assertThat(page.nextCursor()).isNull();
        verify(repository).list(queriedDay.capture(), isNull(), eq(51));
        assertThat(queriedDay.getValue()).isIn(before, LocalDate.now(ZoneOffset.UTC));
    }

    private static EmailReviewRepository.Candidate candidate() {
        return new EmailReviewRepository.Candidate(DAY,
                new EmailDeliveryRepository.Key(UUID.randomUUID(), "2026-11", Uuids.timeBased()));
    }
}
