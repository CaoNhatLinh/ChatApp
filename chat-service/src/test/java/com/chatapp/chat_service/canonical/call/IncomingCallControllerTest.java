package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.yaml.snakeyaml.Yaml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real MVC binding, canonical advice and serialization; discovery authority is mocked. */
class IncomingCallControllerTest {
    private static final String PATH = "/api/calls/incoming";
    private final IncomingCallService calls = mock(IncomingCallService.class);
    private final SecurityContextHelper security = mock(SecurityContextHelper.class);
    private final UUID actor = UUID.randomUUID();
    private final ObjectMapper mapper = new JacksonConfig().objectMapper();
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new IncomingCallController(calls, security))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(mapper)).build();

    IncomingCallControllerTest() {
        when(security.getCurrentUserId()).thenReturn(actor);
    }

    @Test void defaultsToAuthenticatedActorAndSerializesOnlyTheCanonicalPageAndSnapshot() throws Exception {
        var state = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), actor, CallState.Type.VIDEO, Instant.parse("2026-10-22T08:00:00Z"), UUID.randomUUID());
        var page = new IncomingCallService.Page(List.of(CallSignalingService.View.of(state)), "next-page", true);
        when(calls.list(actor, null, 25)).thenReturn(page);

        String response = mvc.perform(get(PATH).param("userId", UUID.randomUUID().toString())
                        .param("calleeId", UUID.randomUUID().toString()).param("actor", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.content[0].calleeId").value(actor.toString()))
                .andExpect(jsonPath("$.content[0].status").value("RINGING"))
                .andExpect(jsonPath("$.content[0].createdAt").value("2026-10-22T08:00:00Z"))
                .andExpect(jsonPath("$.nextCursor").value("next-page"))
                .andExpect(jsonPath("$.hasNext").value(true))
                .andReturn().getResponse().getContentAsString();

        var body = mapper.readTree(response);
        assertThat(body.properties()).extracting(Map.Entry::getKey)
                .containsExactlyInAnyOrder("content", "nextCursor", "hasNext");
        assertThat(body.get("content").get(0).properties()).extracting(Map.Entry::getKey)
                .containsExactlyInAnyOrder(Arrays.stream(CallSignalingService.View.class.getRecordComponents())
                        .map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new));
        verify(calls).list(actor, null, 25);
        verifyNoMoreInteractions(calls);
    }

    @Test void forwardsOpaqueCursorAndExplicitLimitWithoutChangingTheActor() throws Exception {
        when(calls.list(actor, "opaque-cursor", 50)).thenReturn(new IncomingCallService.Page(List.of(), null, false));
        mvc.perform(get(PATH).param("cursor", "opaque-cursor").param("limit", "50")
                        .param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        verify(calls).list(actor, "opaque-cursor", 50);
    }

    @Test void filteredEmptyPageStillReturnsItsContinuation() throws Exception {
        when(calls.list(actor, null, 25)).thenReturn(new IncomingCallService.Page(List.of(), "continue-after-filtered-row", true));
        mvc.perform(get(PATH)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value("continue-after-filtered-row"))
                .andExpect(jsonPath("$.hasNext").value(true));
    }

    @Test void exhaustedFeedIsAnEmptyPageWithAnExplicitNullCursor() throws Exception {
        when(calls.list(actor, null, 25)).thenReturn(new IncomingCallService.Page(List.of(), null, false));
        mvc.perform(get(PATH)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value(nullValue()))
                .andExpect(jsonPath("$.hasNext").value(false));
    }

    @Test void malformedLimitFailsBindingBeforeDiscovery() throws Exception {
        mvc.perform(get(PATH).param("limit", "not-an-integer"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.fieldErrors.limit").value("Invalid value"))
                .andExpect(jsonPath("$.path").value(PATH));
        verifyNoInteractions(calls);
    }

    @Test void invalidCursorOrLimitKeepsTheCanonicalClientError() throws Exception {
        when(calls.list(actor, "invalid", 25)).thenThrow(new BadRequestException("Invalid incoming-call cursor"));
        when(calls.list(actor, null, 51)).thenThrow(new BadRequestException("limit must be between 1 and 50"));
        mvc.perform(get(PATH).param("cursor", "invalid"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.path").value(PATH)).andExpect(jsonPath("$.timestamp").isString());
        mvc.perform(get(PATH).param("limit", "51"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
    }

    @Test void discoveryUnavailableIsACanonicalErrorInsteadOfAnEmptyPage() throws Exception {
        when(calls.list(actor, null, 25)).thenThrow(new IllegalStateException("authority unavailable"));
        mvc.perform(get(PATH)).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value("An internal server error occurred"))
                .andExpect(jsonPath("$.path").value(PATH))
                .andExpect(jsonPath("$.content").doesNotExist())
                .andExpect(jsonPath("$.correlationId").isString());
    }

    @Test void sustainedContentionKeepsTheCanonicalConflict() throws Exception {
        when(calls.list(actor, null, 25)).thenThrow(new ConflictException("call authority kept changing"));
        mvc.perform(get(PATH)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.content").doesNotExist());
    }

    @Test @SuppressWarnings("unchecked") void openApiDefinesTheExactCanonicalPageAndAuthenticatedRead() throws Exception {
        Map<String, Object> contract = new Yaml().load(Files.readString(Path.of("..", "docs", "api", "openapi.yaml")));
        var paths = (Map<String, Map<String, Object>>) contract.get("paths");
        var incoming = paths.get("/calls/incoming");
        assertThat(incoming.keySet()).containsExactly("get");
        var operation = (Map<String, Object>) incoming.get("get");
        var parameters = (List<Map<String, Object>>) operation.get("parameters");
        assertThat(parameters).extracting(parameter -> parameter.get("name")).containsExactlyInAnyOrder("cursor", "limit");
        var limit = parameters.stream().filter(parameter -> "limit".equals(parameter.get("name"))).findFirst().orElseThrow();
        assertThat((Map<String, Object>) limit.get("schema")).containsEntry("minimum", 1).containsEntry("maximum", 50).containsEntry("default", 25);
        var responses = (Map<String, Object>) operation.get("responses");
        assertThat(responses).containsKeys("200", "400", "401", "409", "500");
        var components = (Map<String, Object>) contract.get("components");
        var schemas = (Map<String, Map<String, Object>>) components.get("schemas");
        var page = schemas.get("IncomingCallPage");
        var expected = Arrays.stream(IncomingCallService.Page.class.getRecordComponents())
                .map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new);
        assertThat((List<String>) page.get("required")).containsExactlyInAnyOrder(expected);
        var properties = (Map<String, Map<String, Object>>) page.get("properties");
        assertThat(properties.keySet()).containsExactlyInAnyOrder(expected);
        assertThat((Map<String, Object>) properties.get("content").get("items"))
                .containsEntry("$ref", "#/components/schemas/CallSnapshot");
        assertThat(page.get("additionalProperties")).isEqualTo(false);
        assertThat(contract.get("security")).isEqualTo(List.of(Map.of("bearerAuth", List.of())));
    }
}
