package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import org.yaml.snakeyaml.Yaml;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CallHistoryControllerTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), callId = UUID.randomUUID();
    final CallHistoryService calls = mock(CallHistoryService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final ObjectMapper mapper = new JacksonConfig().objectMapper();
    // Same Jackson configuration/advice as the production HTTP layer.
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new CallHistoryController(calls, security))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();
    CallHistoryControllerTest() { when(security.getCurrentUserId()).thenReturn(actor); }

    @Test void ownFeedUsesOnlyAuthenticatedActorAndReturnsCanonicalJsonPage() throws Exception {
        when(calls.own(actor, "2026-10", null, 25)).thenReturn(new CallHistoryService.Page(List.of(), "next", true));
        mvc.perform(get("/api/calls/history").param("month", "2026-10").param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content").isEmpty()).andExpect(jsonPath("$.nextCursor").value("next"))
                .andExpect(jsonPath("$.hasNext").value(true));
        verify(calls).own(actor, "2026-10", null, 25); verifyNoMoreInteractions(calls);
    }
    @Test void roomFeedForwardsExactMonthCursorAndLimitWithoutAnyWrite() throws Exception {
        when(calls.conversation(actor, room, "2026-09", "opaque", 50)).thenReturn(new CallHistoryService.Page(List.of(), null, false));
        mvc.perform(get("/api/conversations/" + room + "/calls/history").param("month", "2026-09").param("cursor", "opaque").param("limit", "50"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.hasNext").value(false));
        verify(calls).conversation(actor, room, "2026-09", "opaque", 50);
    }
    @Test void detailSerializesExactPublicFactsAndNeverHeartbeatOrMedia() throws Exception {
        Instant time = Instant.parse("2026-10-23T08:00:00Z");
        var state = CallState.ringing(room, callId, Uuids.startOf(time.toEpochMilli()), actor, UUID.randomUUID(), CallState.Type.VIDEO, time, UUID.randomUUID());
        when(calls.detail(actor, room, callId)).thenReturn(CallHistoryView.of(state, actor));
        String response = mvc.perform(get("/api/conversations/" + room + "/calls/" + callId + "/history"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.participants.length()").value(2))
                .andExpect(jsonPath("$.participants[0].role").value("CALLER"))
                .andExpect(jsonPath("$.createdAt").value(time.toString())).andReturn().getResponse().getContentAsString();
        assertThat(mapper.readTree(response).properties()).extracting(Map.Entry::getKey).containsExactlyInAnyOrder(
                Arrays.stream(CallHistoryView.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new));
        assertThat(response).doesNotContain("callerSeenAt", "calleeSeenAt", "deadline", "revision", "sdp", "provider", "duration", "joinedAt");
        verify(calls).detail(actor, room, callId);
    }
    @Test void missingMonthAndMalformedPathOrLimitFailCanonicalBinding() throws Exception {
        mvc.perform(get("/api/calls/history")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.month").value("Required"));
        mvc.perform(get("/api/calls/history").param("month", "2026-10").param("limit", "wrong"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.limit").value("Invalid value"));
        mvc.perform(get("/api/conversations/not-uuid/calls/history").param("month", "2026-10"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        verifyNoInteractions(calls);
    }
    @Test void validationForbiddenMissingAndContentionKeepCanonicalErrors() throws Exception {
        when(calls.own(actor, "invalid", null, 25)).thenThrow(new BadRequestException("invalid month"));
        mvc.perform(get("/api/calls/history").param("month", "invalid")).andExpect(status().isBadRequest());
        doThrow(new ForbiddenException("access unavailable")).when(calls).detail(actor, room, callId);
        mvc.perform(get("/api/conversations/" + room + "/calls/" + callId + "/history")).andExpect(status().isForbidden());
        doThrow(new NotFoundException("unavailable")).when(calls).detail(actor, room, callId);
        mvc.perform(get("/api/conversations/" + room + "/calls/" + callId + "/history")).andExpect(status().isNotFound());
        when(calls.own(actor, "2026-10", null, 25)).thenThrow(new ConflictException("reload"));
        mvc.perform(get("/api/calls/history").param("month", "2026-10")).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }
    @Test void storeFailureReturnsSanitizedErrorNotSuccessfulEmptyHistory() throws Exception {
        when(calls.own(actor, "2026-10", null, 25)).thenThrow(new IllegalStateException("private datastore detail"));
        mvc.perform(get("/api/calls/history").param("month", "2026-10"))
                .andExpect(status().isInternalServerError()).andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An internal server error occurred"))
                .andExpect(jsonPath("$.content").doesNotExist());
    }
    @Test @SuppressWarnings("unchecked") void openApiAndManifestMatchActualReadRoutesFieldsAndBounds() throws Exception {
        Map<String, Object> api = new Yaml().load(Files.readString(Path.of("..", "docs", "api", "openapi.yaml")));
        var paths = (Map<String, Map<String, Object>>) api.get("paths");
        String[] routes = {"/calls/history", "/conversations/{conversationId}/calls/history", "/conversations/{conversationId}/calls/{callId}/history"};
        String manifest = Files.readString(Path.of("..", "docs", "contracts", "canonical-api.yaml"));
        for (String route : routes) {
            assertThat(paths.get(route)).containsOnlyKeys("get"); assertThat(manifest).contains("GET " + route);
            var operation = (Map<String, Object>) paths.get(route).get("get");
            assertThat(operation).doesNotContainKey("security");
            assertThat((Map<String, Object>) operation.get("responses")).containsKeys("200", "400", "401", "409", "500");
        }
        var components = (Map<String, Object>) api.get("components");
        var parameters = (Map<String, Map<String, Object>>) components.get("parameters");
        assertThat(parameters.get("CallHistoryMonth")).containsEntry("required", true);
        assertThat((Map<String, Object>) parameters.get("CallHistoryLimit").get("schema")).containsEntry("minimum", 1).containsEntry("maximum", 50).containsEntry("default", 25);
        var schemas = (Map<String, Map<String, Object>>) components.get("schemas");
        for (var entry : Map.of("CallHistoryPage", CallHistoryService.Page.class,
                "CallHistoryEntry", CallHistoryView.class, "CallHistoryParticipant", CallHistoryView.Participant.class).entrySet()) {
            var schema = schemas.get(entry.getKey());
            String[] fields = Arrays.stream(entry.getValue().getRecordComponents()).map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new);
            assertThat((List<String>) schema.get("required")).containsExactlyInAnyOrder(fields);
            assertThat(((Map<String, Object>) schema.get("properties")).keySet()).containsExactlyInAnyOrder(fields);
            assertThat(schema).containsEntry("additionalProperties", false);
        }
        var properties = (Map<String, Map<String, Object>>) schemas.get("CallHistoryEntry").get("properties");
        assertThat((List<String>) properties.get("outcome").get("enum")).containsExactlyInAnyOrder(
                Arrays.stream(CallHistoryView.Outcome.values()).map(Enum::name).toArray(String[]::new));
        assertThat(api.get("security")).isEqualTo(List.of(Map.of("bearerAuth", List.of())));
    }
}
