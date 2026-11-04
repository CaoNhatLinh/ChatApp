package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.List;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class StickerCatalogControllerTest {
    @Test void singleAdminPackUsesAuthenticatedActorAndDisablesCaching() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), packId = UUID.randomUUID(), coverId = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(catalog.adminPack(actor, packId)).thenReturn(new StickerCatalogService.PackView(packId, "Artwork", "", coverId,
                null, false, false, UUID.randomUUID(), java.time.Instant.now()));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security)).build();
        mvc.perform(get("/api/admin/sticker-packs/" + packId).accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.coverAssetId").value(coverId.toString())).andExpect(jsonPath("$.cover").isEmpty());
        verify(catalog).adminPack(actor, packId);
    }
    @Test void singleStickerRouteUsesActorAndNoStore() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), packId = UUID.randomUUID(), stickerId = UUID.randomUUID(), revision = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(catalog.adminSticker(actor, packId, stickerId)).thenReturn(new StickerCatalogService.AdminStickerView(revision,
                new StickerCatalogService.StickerView(stickerId, packId, "Wave", 7, false, UUID.randomUUID(), null)));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security)).build();
        mvc.perform(get("/api/admin/sticker-packs/" + packId + "/stickers/" + stickerId).accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.packRevision").value(revision.toString())).andExpect(jsonPath("$.sticker.name").value("Wave"));
        verify(catalog).adminSticker(actor, packId, stickerId);
    }
    @Test void userCannotSelectAdminModeOrAnotherActor() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(catalog.packs(actor, false, null, 25)).thenReturn(new StickerCatalogService.Page<>(List.of(), null, false));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security)).build();
        mvc.perform(get("/api/sticker-packs").accept(org.springframework.http.MediaType.APPLICATION_JSON)
                        .param("admin", "true").param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.content").isEmpty()).andExpect(jsonPath("$.hasNext").value(false));
        verify(catalog).packs(actor, false, null, 25);
        verifyNoMoreInteractions(catalog);
    }

    @Test void adminItemRoutePassesAuthenticatedActorAndExactCursor() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), pack = UUID.randomUUID();
        String cursor = pack + ":4:" + UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(catalog.stickers(actor, true, pack, cursor, 7)).thenReturn(new StickerCatalogService.Page<>(List.of(), null, false));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security)).build();
        mvc.perform(get("/api/admin/sticker-packs/" + pack + "/stickers").accept(org.springframework.http.MediaType.APPLICATION_JSON)
                        .param("cursor", cursor).param("limit", "7"))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        verify(catalog).stickers(actor, true, pack, cursor, 7);
    }

    @Test void invalidPathOrNonNumericLimitDoesNotReachService() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/api/sticker-packs/not-a-uuid/stickers").accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        mvc.perform(get("/api/sticker-packs").param("limit", "invalid").accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        verifyNoInteractions(catalog, security);
    }

    @Test void serviceValidationAndPermissionErrorsKeepCanonicalStatus() throws Exception {
        var catalog = mock(StickerCatalogService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(catalog.packs(actor, false, null, 51)).thenThrow(new BadRequestException("limit must be between 1 and 50"));
        when(catalog.packs(actor, true, null, 25)).thenThrow(new ForbiddenException("denied"));
        var mvc = MockMvcBuilders.standaloneSetup(new StickerCatalogController(catalog, security))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/api/sticker-packs").param("limit", "51").accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        mvc.perform(get("/api/admin/sticker-packs").accept(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
}
