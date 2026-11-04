package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminReportHttpContractTest {
    private final UUID actor = UUID.randomUUID(), reporter = UUID.randomUUID(), reportId = UUID.randomUUID();
    private final UUID createdAt = Uuids.timeBased();
    private final ModerationRepository repository = mock(ModerationRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final MockMvc mvc;

    AdminReportHttpContractTest() {
        var security = mock(SecurityContextHelper.class);
        when(security.getCurrentUserId()).thenReturn(actor);
        var service = new AdminModerationService(repository, mock(CanonicalCqlStore.class), mock(UserRepository.class),
                mock(ConversationModerationRepository.class), authorization, mock(CanonicalEventRecorder.class));
        mvc = MockMvcBuilders.standaloneSetup(new AdminModerationController(service, security))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    }

    @Test
    void returnsOneAuthorizedUncachedReportInTheQueueFormat() throws Exception {
        when(repository.findReportByIdentity(reporter, createdAt, reportId)).thenReturn(new ModerationRepository.ReportRow(
                reportId, createdAt, LocalDate.of(2026, 11, 3), "IN_REVIEW", reporter, "USER", UUID.randomUUID(),
                null, null, null, "SPAM", "Reported content", actor, null, null));
        mvc.perform(lookup(createdAt)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.reportId").value(reportId.toString()))
                .andExpect(jsonPath("$.reporterId").value(reporter.toString()))
                .andExpect(jsonPath("$.createdAtKey").value(createdAt.toString()))
                .andExpect(jsonPath("$.status").value("IN_REVIEW"))
                .andExpect(jsonPath("$.assignedTo").value(actor.toString()));
        var order = inOrder(authorization, repository);
        order.verify(authorization).require(actor, AppPermission.REPORT_MANAGE);
        order.verify(repository).findReportByIdentity(reporter, createdAt, reportId);
    }

    @Test
    void rejectsNonTimeUuidBeforeReadingStorage() throws Exception {
        mvc.perform(lookup(UUID.randomUUID())).andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @Test
    void refusesAccessBeforeReadingStorage() throws Exception {
        doThrow(new ForbiddenException("permission denied")).when(authorization).require(actor, AppPermission.REPORT_MANAGE);
        mvc.perform(lookup(createdAt)).andExpect(status().isForbidden());
        verifyNoInteractions(repository);
    }

    @Test
    void returnsNotFoundForUnknownExactIdentity() throws Exception {
        mvc.perform(lookup(createdAt)).andExpect(status().isNotFound());
        verify(repository).findReportByIdentity(reporter, createdAt, reportId);
        verifyNoMoreInteractions(repository);
    }

    private MockHttpServletRequestBuilder lookup(UUID creationKey) {
        return get("/api/admin/reports/" + reportId)
                .param("reporterId", reporter.toString()).param("createdAtKey", creationKey.toString());
    }
}
