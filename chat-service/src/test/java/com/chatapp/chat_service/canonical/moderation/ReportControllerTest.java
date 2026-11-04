package com.chatapp.chat_service.canonical.moderation;

import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.LocalDate;
import java.util.UUID;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ReportControllerTest {
    private final ReportService reports = mock(ReportService.class);
    private final SecurityContextHelper security = mock(SecurityContextHelper.class);
    private final UUID reporter = UUID.randomUUID();
    private final UUID target = UUID.randomUUID();
    private final ReportService.CreateReportRequest request = new ReportService.CreateReportRequest(
            "USER", target, null, null, null, "SPAM", null);
    private final String body = """
            {"targetType":"USER","targetUserId":"%s","reasonCode":"SPAM"}
            """.formatted(target);
    private final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ReportController(reports, security))
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test
    void aKeyedRetryReturnsTheCurrentReportForTheAuthenticatedReporter() throws Exception {
        UUID key = UUID.randomUUID(), reportId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(reporter);
        when(reports.create(reporter, request, key)).thenReturn(new ModerationRepository.ReportRow(
                reportId, Uuids.timeBased(), LocalDate.of(2026, 11, 4), "RESOLVED", reporter,
                "USER", target, null, null, null, "SPAM", null, null, null, null));

        mvc.perform(post("/api/reports").contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON).content(body)
                        .header("Idempotency-Key", key.toString()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reportId").value(reportId.toString()))
                .andExpect(jsonPath("$.status").value("RESOLVED"));
        verify(reports).create(reporter, request, key);
    }

    @Test
    void existingClientsCanOmitTheKey() throws Exception {
        when(security.getCurrentUserId()).thenReturn(reporter);
        mvc.perform(post("/api/reports").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());
        verify(reports).create(reporter, request, null);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "invalid", "1-1-1-1-1"})
    void aPresentButMalformedKeyDoesNotCreateAReport(String key) throws Exception {
        mvc.perform(post("/api/reports").contentType(MediaType.APPLICATION_JSON).content(body)
                        .header("Idempotency-Key", key))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(reports);
    }
}
