package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StickerMessageControllerTest {
    @Test void historyArtworkUsesAuthenticatedActorAndNoStore() throws Exception {
        var service = mock(StickerMessageService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = UUID.randomUUID(), stickerId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(service.artwork(actor, room, "2026-10-12-01:00", messageId)).thenReturn(new StickerCatalogService.StickerArtworkView(stickerId, "Wave", null));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerMessageController(service, security)).build();
        mvc.perform(get("/api/conversations/" + room + "/messages/" + messageId + "/sticker").accept(org.springframework.http.MediaType.APPLICATION_JSON)
                .param("bucket", "2026-10-12-01:00").param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.stickerId").value(stickerId.toString())).andExpect(jsonPath("$.image").isEmpty());
        verify(service).artwork(actor, room, "2026-10-12-01:00", messageId);
    }
    @Test void forbiddenHistoryKeepsCanonicalErrorStatus() throws Exception {
        var service = mock(StickerMessageService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(service.artwork(actor, room, "2026-10-12-01:00", messageId)).thenThrow(new ForbiddenException("not member"));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerMessageController(service, security))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/api/conversations/" + room + "/messages/" + messageId + "/sticker").accept(org.springframework.http.MediaType.APPLICATION_JSON).param("bucket", "2026-10-12-01:00"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
