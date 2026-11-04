package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.http.MediaType;
import java.time.Instant;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StickerAdminControllerTest {
    final StickerAdminService service = mock(StickerAdminService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new StickerAdminController(service, security))
            .setControllerAdvice(new GlobalExceptionHandler()).build();

    @Test void invalidBodyFailsAtBoundaryBeforeMutation() throws Exception {
        mvc.perform(post("/api/admin/sticker-packs").contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\",\"reason\":\"\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/api/admin/sticker-packs").contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON)
                        .content("{\"commandId\":\"not-a-uuid\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        verifyNoInteractions(service, security);
    }
    @Test void actorComesFromSessionAndCommittedResponseIsNotCached() throws Exception {
        UUID actor = UUID.randomUUID(), packId = UUID.randomUUID(), commandId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        var pack = new StickerRepository.Pack(packId, "Expressions", "", null, false, false, UUID.randomUUID(), Instant.now());
        when(service.createPack(eq(actor), any())).thenReturn(new StickerAdminService.Result(commandId, pack, null, true));
        String body = "{\"commandId\":\"" + commandId + "\",\"stickerPackId\":\"" + packId
                + "\",\"name\":\"Expressions\",\"reason\":\"Create pack\",\"actorId\":\"" + UUID.randomUUID() + "\"}";
        mvc.perform(post("/api/admin/sticker-packs").contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.pack.isActive").value(false)).andExpect(jsonPath("$.auditPending").value(true));
        verify(service).createPack(eq(actor), any());
    }
    @Test void forbiddenAndStaleRevisionKeepCorrectStatuses() throws Exception {
        UUID actor = UUID.randomUUID(), packId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(service.updatePack(eq(actor), eq(packId), any())).thenThrow(new ConflictException("reload"));
        String body = "{\"commandId\":\"" + UUID.randomUUID() + "\",\"expectedRevision\":\"" + UUID.randomUUID()
                + "\",\"name\":\"Expressions\",\"reason\":\"Edit\"}";
        mvc.perform(put("/api/admin/sticker-packs/" + packId).contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
        when(service.updatePack(eq(actor), eq(packId), any())).thenThrow(new ForbiddenException("denied"));
        mvc.perform(put("/api/admin/sticker-packs/" + packId).contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
