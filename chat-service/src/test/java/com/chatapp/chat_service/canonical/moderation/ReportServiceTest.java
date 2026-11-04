package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.message.MessageRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class ReportServiceTest {
    private static final String BUCKET = "2025-12-31-23:02";
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final MessageRepository messages = mock(MessageRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final ConversationAuthorizationService authorization = new ConversationAuthorizationService(
            store, mock(CanonicalConversationRepository.class));
    private final ReportService service = new ReportService(repository, store, messages, users, events, authorization);

    @Test
    void nullPayloadIsRejectedAsBadRequest() {
        assertThatThrownBy(() -> service.create(UUID.randomUUID(), null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("report payload is required");
        verifyNoInteractions(repository, store, events);
    }

    @Test
    void keyedRetryUsesTheCommittedIdentityAndRejectsChangedPayload() {
        UUID reporter = UUID.randomUUID(), target = UUID.randomUUID(), key = UUID.randomUUID(), id = UUID.randomUUID();
        UUID createdAt = Uuids.timeBased();
        when(users.findById(target)).thenReturn(mock(CqlCanonicalRecords.CanonicalUser.class));
        var resolved = new ModerationRepository.ReportRow(id, createdAt, LocalDate.now(), "RESOLVED",
                reporter, "USER", target, null, null, null, "SPAM", "same", null, null, null);
        var claim = new java.util.concurrent.atomic.AtomicReference<ModerationRepository.CreateCommand>();
        when(repository.findCreateCommand(reporter, key)).thenAnswer(ignored -> claim.get());
        when(repository.prepareCreate(eq(reporter), eq(key), anyString(), eq(target), eq("USER"), isNull(), isNull(),
                isNull(), eq("SPAM"), eq("same"))).thenAnswer(call -> {
            var command = new ModerationRepository.CreateCommand(call.getArgument(2), createdAt, id, target);
            return new ModerationRepository.CreatePreparation((byte) 0, reporter, key, command, "USER", null,
                    null, null, "SPAM", "same");
        });
        when(repository.resumePreparedCreate(any())).thenAnswer(call -> {
            ModerationRepository.CreatePreparation preparation = call.getArgument(0);
            claim.set(preparation.command());
            return resolved;
        });
        when(repository.completeCreateCommand(eq(reporter), any(), eq("USER"), isNull(), isNull(),
                isNull(), eq("SPAM"), eq("same"))).thenReturn(resolved);

        assertThat(service.create(reporter, new ReportService.CreateReportRequest(
                "user", target, null, null, null, " SPAM ", "same "), key)).isSameAs(resolved);
        assertThat(service.create(reporter, new ReportService.CreateReportRequest(
                "USER", target, null, null, null, "SPAM", "same"), key)).isSameAs(resolved);
        assertThatThrownBy(() -> service.create(reporter, new ReportService.CreateReportRequest(
                "USER", target, null, null, null, "SPAM", "different"), key)).isInstanceOf(ConflictException.class);
        verify(users).findById(target);
        verify(repository).prepareCreate(eq(reporter), eq(key), anyString(), eq(target), eq("USER"), isNull(), isNull(),
                isNull(), eq("SPAM"), eq("same"));
        verify(repository).completeCreateCommand(reporter, claim.get(), "USER", null, null, null, "SPAM", "same");
        verifyNoInteractions(events);
    }

    @Test
    void keyedRetryResumesAuthorizedPreparationWithoutRevalidatingItsTarget() {
        UUID reporter = UUID.randomUUID(), target = UUID.randomUUID(), key = UUID.randomUUID(), id = UUID.randomUUID();
        UUID createdAt = Uuids.timeBased();
        var user = mock(CqlCanonicalRecords.CanonicalUser.class);
        when(users.findById(target)).thenReturn(user).thenReturn(null);
        var row = new ModerationRepository.ReportRow(id, createdAt, LocalDate.now(), "OPEN",
                reporter, "USER", target, null, null, null, "SPAM", "details", null, null, null);
        var pending = new java.util.concurrent.atomic.AtomicReference<ModerationRepository.CreatePreparation>();
        when(repository.findCreatePreparation(reporter, key)).thenAnswer(ignored -> pending.get());
        when(repository.prepareCreate(eq(reporter), eq(key), anyString(), eq(target), eq("USER"), isNull(), isNull(),
                isNull(), eq("SPAM"), eq("details"))).thenAnswer(call -> {
            var preparation = new ModerationRepository.CreatePreparation((byte) 0, reporter, key,
                    new ModerationRepository.CreateCommand(call.getArgument(2), createdAt, id, target),
                    "USER", null, null, null, "SPAM", "details");
            pending.set(preparation);
            return preparation;
        });
        when(repository.resumePreparedCreate(any())).thenThrow(new IllegalStateException("interrupted")).thenReturn(row);
        var request = new ReportService.CreateReportRequest("USER", target, null, null, null, "SPAM", "details");
        assertThatThrownBy(() -> service.create(reporter, request, key)).hasMessage("interrupted");
        assertThat(service.create(reporter, request, key)).isSameAs(row);
        verify(users).findById(target);
        verify(repository, times(2)).resumePreparedCreate(pending.get());
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
        when(users.findById(target)).thenReturn(null);

        assertThatThrownBy(() -> service.create(reporter,
                new ReportService.CreateReportRequest("USER", target, null, null, null, "ABUSE", "details")))
                .hasMessage("user not found");
        verify(repository, never()).createReport(any(), anyString(), any(), any(), any(), any(), anyString(), any());
    }

    @Test
    void userReportIsPersistedAndAudited() {
        UUID reporter = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        when(users.findById(target)).thenReturn(new CqlCanonicalRecords.CanonicalUser(
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

    @Test
    void rejectsMixedTargetsAndNonTimeUuidBeforeAnyEvidenceLookup() {
        UUID reporter = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID message = Uuids.timeBased();
        var requests = java.util.List.of(
                new ReportService.CreateReportRequest("USER", other, room, null, null, "SPAM", null),
                new ReportService.CreateReportRequest("CONVERSATION", other, room, null, null, "SPAM", null),
                new ReportService.CreateReportRequest("CONVERSATION", null, room, BUCKET, message, "SPAM", null),
                new ReportService.CreateReportRequest("MESSAGE", other, room, BUCKET, message, "SPAM", null),
                new ReportService.CreateReportRequest("MESSAGE", null, room, BUCKET, UUID.randomUUID(), "SPAM", null),
                new ReportService.CreateReportRequest("MESSAGE", null, room, "2025-12-31-23:16", message, "SPAM", null));
        for (var request : requests) {
            assertThatThrownBy(() -> service.create(reporter, request)).isInstanceOf(BadRequestException.class);
        }
        verifyNoInteractions(repository, store, messages, users, events);
    }

    @Test
    void nonmemberCannotProbeConversationOrMessageExistence() {
        UUID reporter = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        var roomReport = new ReportService.CreateReportRequest("CONVERSATION", null, room, null, null, "SPAM", null);
        var messageReport = new ReportService.CreateReportRequest("MESSAGE", null, room, BUCKET, Uuids.timeBased(), "SPAM", null);

        assertThatThrownBy(() -> service.create(reporter, roomReport)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.create(reporter, messageReport)).isInstanceOf(ForbiddenException.class);

        verify(store, times(2)).findConversationMember(room, reporter);
        verifyNoMoreInteractions(store);
        verifyNoInteractions(repository, messages, users, events);
    }

    @Test
    void memberCanReportVisibleMessageInArchivedRoomAndAuthorComesFromAuthority() {
        UUID reporter = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID author = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        memberInArchivedConversation(reporter, room);
        var message = mock(CqlCanonicalRecords.CanonicalMessage.class);
        when(message.senderId()).thenReturn(author);
        when(messages.find(room, BUCKET, messageId)).thenReturn(message);
        var persisted = mock(ModerationRepository.ReportRow.class);
        UUID reportId = UUID.randomUUID();
        when(persisted.reportId()).thenReturn(reportId);
        when(repository.createReport(reporter, "MESSAGE", author, room, BUCKET, messageId, "SPAM", null)).thenReturn(persisted);

        assertThat(service.create(reporter, new ReportService.CreateReportRequest(
                "MESSAGE", null, room, " " + BUCKET + " ", messageId, "SPAM", null))).isSameAs(persisted);

        var flow = inOrder(store, messages, repository, events);
        flow.verify(store).findConversationMember(room, reporter);
        flow.verify(store).findConversation(room);
        flow.verify(messages).find(room, BUCKET, messageId);
        flow.verify(repository).createReport(reporter, "MESSAGE", author, room, BUCKET, messageId, "SPAM", null);
        flow.verify(events).record(eq(reporter), eq(room), eq("REPORT_CREATED"), eq("report"), eq(reportId.toString()),
                eq(author), eq("SPAM"), anyMap(), anyMap(), anyMap());
        verifyNoInteractions(users);
    }

    @Test
    void memberCannotReportDeletedOrOwnMessage() {
        UUID reporter = UUID.randomUUID();
        UUID room = UUID.randomUUID();
        UUID messageId = Uuids.timeBased();
        memberInArchivedConversation(reporter, room);
        var deleted = mock(CqlCanonicalRecords.CanonicalMessage.class);
        when(deleted.isDeleted()).thenReturn(true);
        var own = mock(CqlCanonicalRecords.CanonicalMessage.class);
        when(own.senderId()).thenReturn(reporter);
        when(messages.find(room, BUCKET, messageId)).thenReturn(null, deleted, own);
        var request = new ReportService.CreateReportRequest("MESSAGE", null, room, BUCKET, messageId, "SPAM", null);

        assertThatThrownBy(() -> service.create(reporter, request)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.create(reporter, request)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.create(reporter, request)).isInstanceOf(ConflictException.class);
        verifyNoInteractions(repository, events);
    }

    private void memberInArchivedConversation(UUID reporter, UUID room) {
        when(store.findConversationMember(room, reporter)).thenReturn(mock(CqlCanonicalRecords.CanonicalConversationMember.class));
        var conversation = mock(CqlCanonicalRecords.CanonicalConversation.class);
        when(conversation.isDeleted()).thenReturn(true);
        when(store.findConversation(room)).thenReturn(conversation);
    }
}
