package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.yaml.snakeyaml.Yaml;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import static com.chatapp.chat_service.canonical.media.MediaThumbnail.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MediaThumbnailControllerTest {
    final UUID actor = UUID.randomUUID(), assetId = UUID.randomUUID();
    final CloudinaryMediaService media = mock(CloudinaryMediaService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new MediaController(media, security)).setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();

    MediaThumbnailControllerTest() { when(security.getCurrentUserId()).thenReturn(actor); }

    @Test void ownerInspectionUsesAuthenticatedActorAndSerializesPersistedFactsNoStore() throws Exception {
        var rows = List.of(new MediaThumbnail(Variant.SMALL, Status.READY,
                "https://res.cloudinary.com/test/small.png", 2, 3, Instant.parse("2026-10-23T00:00:00Z")));
        when(media.thumbnails(actor, assetId)).thenReturn(new CloudinaryMediaService.ThumbnailView(assetId, true, rows));
        mvc.perform(get("/api/files/" + assetId + "/thumbnails").param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.assetId").value(assetId.toString())).andExpect(jsonPath("$.applicable").value(true))
                .andExpect(jsonPath("$.variants[0].variant").value("SMALL"))
                .andExpect(jsonPath("$.variants[0].status").value("READY"))
                .andExpect(jsonPath("$.variants[0].width").value(2)).andExpect(jsonPath("$.variants[0].height").value(3));
        verify(media).thumbnails(actor, assetId);
        verifyNoMoreInteractions(media);
    }

    @Test void bindingAndForbiddenFailuresUseExistingErrorContract() throws Exception {
        mvc.perform(get("/api/files/not-uuid/thumbnails")).andExpect(status().isBadRequest());
        verifyNoInteractions(media);
        when(media.thumbnails(actor, assetId)).thenThrow(new ForbiddenException("only the media owner can inspect this upload"));
        mvc.perform(get("/api/files/" + assetId + "/thumbnails")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test void emptyPersistedRowsAreNotInventedProcessingOrReadyStates() throws Exception {
        when(media.thumbnails(actor, assetId)).thenReturn(new CloudinaryMediaService.ThumbnailView(assetId, true, List.of()));
        mvc.perform(get("/api/files/" + assetId + "/thumbnails")).andExpect(status().isOk())
                .andExpect(jsonPath("$.applicable").value(true)).andExpect(jsonPath("$.variants").isEmpty());
    }

    @Test void openApiContainsOwnerReadAndBoundedVariantSchema() throws Exception {
        Map<?, ?> doc = new Yaml().load(Files.readString(Path.of("../docs/api/openapi.yaml")));
        Map<?, ?> paths = (Map<?, ?>) doc.get("paths");
        assertThat(paths.containsKey("/files/{assetId}/thumbnails")).isTrue();
        Map<?, ?> schemas = (Map<?, ?>) ((Map<?, ?>) doc.get("components")).get("schemas");
        Map<?, ?> thumbnail = (Map<?, ?>) schemas.get("MediaThumbnail");
        assertThat(thumbnail.get("required")).isEqualTo(List.of("variant", "status", "createdAt"));
    }
}
