package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.appauth.*;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import java.util.UUID;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class SystemSettingsHttpTest {
    private final UUID actor = UUID.randomUUID();
    private final SystemSettingsRepository repository = mock(SystemSettingsRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final SystemSettingsAuditRecovery recovery = mock(SystemSettingsAuditRecovery.class);
    private final SystemSettingsService service = new SystemSettingsService(repository, authorization, recovery);
    private final MockMvc mvc;
    SystemSettingsHttpTest() {
        var security = mock(SecurityContextHelper.class);
        when(security.getCurrentUserId()).thenReturn(actor);
        mvc = MockMvcBuilders.standaloneSetup(new SystemSettingsController(service, security))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    }
    @Test void fullFiniteCatalogIsNoStoreAndValuesKeepJsonTypes() throws Exception {
        mvc.perform(get("/api/admin/system-settings")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.length()").value(2)).andExpect(jsonPath("$[0].value").isBoolean())
                .andExpect(jsonPath("$[1].value").isNumber())
                .andExpect(jsonPath("$[0].revision").value(SystemSettingsRepository.PRISTINE_REVISION.toString()));
    }
    @Test void malformedCommandAndStringBooleanFailBeforeReservation() throws Exception {
        for (var body : new String[]{"{}", "{\"commandId\":\"bad\"}", body(UUID.randomUUID(), "\"false\"", "reason")}) {
            mvc.perform(put("/api/admin/system-settings/community.creationEnabled").contentType(MediaType.APPLICATION_JSON)
                    .content(body)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(repository, recovery);
    }
    @Test void permissionFailureDoesNotExposeCatalogOrReadStorage() throws Exception {
        doThrow(new ForbiddenException("forbidden")).when(authorization).require(actor, AppPermission.SYSTEM_OPERATE);
        mvc.perform(get("/api/admin/system-settings")).andExpect(status().isForbidden());
        verifyNoInteractions(repository, recovery);
    }
    @Test void committedSettingAndStaleWriteUseCanonicalResponseAndConflict() throws Exception {
        when(repository.save(any(), any())).thenAnswer(call -> {
            SystemSettingsRepository.Command command = call.getArgument(0);
            when(repository.find(command.state().key())).thenReturn(command.state());
            return true;
        });
        UUID id = UUID.randomUUID();
        mvc.perform(put("/api/admin/system-settings/community.creationEnabled").contentType(MediaType.APPLICATION_JSON)
                .content(body(id, "false", "Pause creation"))).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.commandId").value(id.toString()))
                .andExpect(jsonPath("$.setting.value").value(false))
                .andExpect(jsonPath("$.setting.revision").value(id.toString()))
                .andExpect(jsonPath("$.auditPending").value(false));
        mvc.perform(put("/api/admin/system-settings/community.creationEnabled").contentType(MediaType.APPLICATION_JSON)
                .content(body(UUID.randomUUID(), "true", "Stale form"))).andExpect(status().isConflict());
        verify(repository, times(1)).save(any(), any());
    }
    private String body(UUID id, String value, String reason) {
        return "{\"commandId\":\"%s\",\"expectedRevision\":\"%s\",\"value\":%s,\"reason\":\"%s\"}"
                .formatted(id, SystemSettingsRepository.PRISTINE_REVISION, value, reason);
    }
}
