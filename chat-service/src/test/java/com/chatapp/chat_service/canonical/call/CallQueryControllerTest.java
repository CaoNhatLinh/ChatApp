package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real MVC binding/advice/serialization, mocked authority; no live auth/datastore claim. */
class CallQueryControllerTest {
    final CallLifecycleService calls = mock(CallLifecycleService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CallQueryController(calls, security))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    CallQueryControllerTest() { when(security.getCurrentUserId()).thenReturn(actor); }
    String path() { return "/api/conversations/" + room + "/calls/active"; }
    @Test void publicSnapshotUsesAuthenticatedActorNotCallerSuppliedIdentity() throws Exception {
        var call = CallState.ringing(room, UUID.randomUUID(), UUID.randomUUID(), actor, UUID.randomUUID(), CallState.Type.VOICE, Instant.now(), UUID.randomUUID());
        when(calls.active(actor, room)).thenReturn(call);
        mvc.perform(get(path()).param("userId", UUID.randomUUID().toString())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.callId").value(call.callId().toString()))
                .andExpect(jsonPath("$.callerId").value(actor.toString()))
                .andExpect(jsonPath("$.status").value("RINGING")).andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.createdAt").isString()).andExpect(jsonPath("$.deadline").isString())
                .andExpect(jsonPath("$.callerSeenAt").doesNotExist()).andExpect(jsonPath("$.startedOrder").doesNotExist())
                .andExpect(jsonPath("$.signal").doesNotExist());
        verify(calls).active(actor, room);
    }
    @Test void noCallIsNoContentAndNeverCacheable() throws Exception {
        mvc.perform(get(path())).andExpect(status().isNoContent())
                .andExpect(header().string("Cache-Control", "no-store")).andExpect(content().string(""));
    }
    @Test void canonicalErrorsRemainDistinctFromNoCall() throws Exception {
        when(calls.active(actor, room)).thenThrow(new ForbiddenException("not member"),
                new NotFoundException("active conversation is required"), new ConflictException("state changed"),
                new BadRequestException("direct conversations only"));
        mvc.perform(get(path())).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(get(path())).andExpect(status().isNotFound());
        mvc.perform(get(path())).andExpect(status().isConflict());
        mvc.perform(get(path())).andExpect(status().isBadRequest());
    }
    @Test void malformedRoomFailsBeforeAuthorityLookup() throws Exception {
        mvc.perform(get("/api/conversations/not-a-uuid/calls/active")).andExpect(status().isBadRequest());
        verifyNoInteractions(calls);
    }
    @Test @SuppressWarnings("unchecked") void httpAndStompSnapshotContractsMatchThePublicView() throws Exception {
        var yaml = new org.yaml.snakeyaml.Yaml();
        var http = (java.util.Map<String, Object>) yaml.load(java.nio.file.Files.readString(java.nio.file.Path.of("..", "docs", "api", "openapi.yaml")));
        var stomp = (java.util.Map<String, Object>) yaml.load(java.nio.file.Files.readString(java.nio.file.Path.of("..", "docs", "api", "asyncapi.yaml")));
        var expected = java.util.Arrays.stream(CallSignalingService.View.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new);
        for (var contract : java.util.List.of(http, stomp)) {
            var components = (java.util.Map<String, Object>) contract.get("components");
            var schemas = (java.util.Map<String, java.util.Map<String, Object>>) components.get("schemas");
            var snapshot = schemas.get("CallSnapshot");
            org.assertj.core.api.Assertions.assertThat((java.util.List<String>) snapshot.get("required")).containsExactlyInAnyOrder(expected);
            org.assertj.core.api.Assertions.assertThat(((java.util.Map<String, Object>) snapshot.get("properties")).keySet()).containsExactlyInAnyOrder(expected);
        }
    }
}
