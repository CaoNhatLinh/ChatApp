package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ReportServiceTest {
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final ReportService service = new ReportService(repository, store, events);

    @Test
    void nullPayloadIsRejectedAsBadRequest() {
        assertThatThrownBy(() -> service.create(UUID.randomUUID(), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("report payload is required");
        verifyNoInteractions(repository, store, events);
    }

    @Test
    void malformedTargetIsRejectedBeforePersistence() {
        UUID reporter = UUID.randomUUID();

        assertThatThrownBy(() -> service.create(reporter,
                new ReportService.CreateReportRequest("MESSAGE", null, UUID.randomUUID(), "bad", UUID.randomUUID(), "SPAM", "x")))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(repository);
    }

    @Test
    void reportRequiresAnExistingTargetUser() {
        UUID reporter = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        when(store.findUserById(target)).thenReturn(null);

        assertThatThrownBy(() -> service.create(reporter,
                new ReportService.CreateReportRequest("USER", target, null, null, null, "ABUSE", "details")))
                .hasMessage("user not found");
        verify(repository, never()).createReport(any(), anyString(), any(), any(), any(), any(), anyString(), any());
    }

    @Test
    void userReportIsPersistedAndAudited() {
        UUID reporter = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        when(store.findUserById(target)).thenReturn(new CqlCanonicalRecords.CanonicalUser(
                target, "target", "target", "target@example.com", "target@example.com", "hash",
                "LOCAL", null, "Target", null, "ACTIVE", null, null, null));
        ModerationRepository.ReportRow persisted = new ModerationRepository.ReportRow(
                UUID.randomUUID(), UUID.randomUUID(), LocalDate.now(), "OPEN", reporter, "USER", target,
                null, null, null, "HARASSMENT", "details", null, null, null);
        when(repository.createReport(reporter, "USER", target, null, null, null, "HARASSMENT", "details"))
                .thenReturn(persisted);

        var result = service.create(reporter,
                new ReportService.CreateReportRequest("user", target, null, null, null, "HARASSMENT", " details "));

        assertThat(result).isSameAs(persisted);
        verify(events).record(eq(reporter), isNull(), eq("REPORT_CREATED"), eq("report"),
                eq(persisted.reportId().toString()), eq(target), eq("HARASSMENT"), anyMap(), anyMap(), anyMap());
    }
}
