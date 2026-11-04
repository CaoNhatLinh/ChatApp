package com.chatapp.chat_service.canonical.admin;

import com.chatapp.chat_service.canonical.appauth.*;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual controller/service/advice/JSON, controlled authorization and repository. */
class AdminConversationHttpContractTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID();
    final AdminConversationDirectoryRepository repository = mock(AdminConversationDirectoryRepository.class);
    final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final AdminConversationService service = new AdminConversationService(repository, authorization, mock(CanonicalEventRecorder.class));
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new AdminConversationController(service, security))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    AdminConversationHttpContractTest() { when(security.getCurrentUserId()).thenReturn(actor); }

    @Test void authorizedListAndDetailSerializeCanonicalImageAndAreNotCached() throws Exception {
        var summary = summary("https://assets.example.test/room.png");
        when(repository.list("2026-10", 100)).thenReturn(List.of(summary));
        when(repository.detail(room, 200)).thenReturn(summary);
        mvc.perform(get("/api/admin/conversations").param("month", "2026-10").param("limit", "100"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$[0].avatarUrl").value(summary.avatarUrl()));
        mvc.perform(get("/api/admin/conversations/" + room)).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.avatarUrl").value(summary.avatarUrl()));
        verify(authorization, times(2)).require(actor, AppPermission.ROOM_READ);
    }

    @Test void noImageIsNullRatherThanSyntheticArtwork() throws Exception {
        when(repository.detail(room, 200)).thenReturn(summary(null));
        mvc.perform(get("/api/admin/conversations/" + room)).andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test void deniedOperatorCannotReachTheRoomImageRepository() throws Exception {
        doThrow(new ForbiddenException("room read denied")).when(authorization).require(actor, AppPermission.ROOM_READ);
        mvc.perform(get("/api/admin/conversations")).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/conversations/" + room)).andExpect(status().isForbidden());
        verifyNoInteractions(repository);
    }

    @Test void openApiDescribesNullableImageAndBoundedNoStoreReads() throws Exception {
        Map<?, ?> spec = new org.yaml.snakeyaml.Yaml().load(java.nio.file.Files.readString(
                java.nio.file.Path.of("..", "docs", "api", "openapi.yaml")));
        Map<?, ?> summary = object(spec, "components", "schemas", "AdminConversationSummary");
        org.assertj.core.api.Assertions.assertThat(object(summary, "properties", "avatarUrl").get("type"))
                .isEqualTo(List.of("string", "null"));
        org.assertj.core.api.Assertions.assertThat(((List<?>) summary.get("required")).contains("avatarUrl")).isFalse();
        org.assertj.core.api.Assertions.assertThat(object(summary, "properties", "members").get("maxItems")).isEqualTo(500);
        for (String path : List.of("/admin/conversations", "/admin/conversations/{conversationId}")) {
            Map<?, ?> response = object(spec, "paths", path, "get", "responses", "200");
            org.assertj.core.api.Assertions.assertThat(object(response, "headers", "Cache-Control", "schema").get("const"))
                    .isEqualTo("no-store");
        }
        org.assertj.core.api.Assertions.assertThat(object(spec, "paths", "/admin/conversations", "get", "responses", "200",
                "content", "application/json", "schema").get("maxItems")).isEqualTo(200);
    }

    private static Map<?, ?> object(Map<?, ?> source, String... keys) {
        Map<?, ?> current = source;
        for (String key : keys) current = (Map<?, ?>) current.get(key);
        return current;
    }

    private AdminConversationDirectoryRepository.AdminConversationSummary summary(String avatarUrl) {
        Instant now = Instant.parse("2026-10-23T00:00:00Z");
        return new AdminConversationDirectoryRepository.AdminConversationSummary(room, "GROUP", "COMMUNITY", "OPEN", "Room", null,
                actor, 2, "OPEN", 0, false, now, now, List.of(), avatarUrl);
    }
}
