package com.chatapp.chat_service.canonical.media;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.UUID;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MediaUploadControllerTest {
    final UUID actor = UUID.randomUUID(), upload = UUID.randomUUID();
    final CloudinaryMediaService media = mock(CloudinaryMediaService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders.standaloneSetup(new MediaController(media, security))
            .setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();

    MediaUploadControllerTest() { when(security.getCurrentUserId()).thenReturn(actor); }

    @Test void multipartIdIsForwardedWithAuthenticatedOwnerAndFile() throws Exception {
        var file = file("file");
        mvc.perform(multipart("/api/files/upload").file(file).param("uploadId", upload.toString()).param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isCreated());
        verify(media).upload(actor, upload, file);
    }

    @Test void absentIdStartsANewIntentRatherThanUsingAContentDedupKey() throws Exception {
        mvc.perform(multipart("/api/files/upload").file(file("file"))).andExpect(status().isCreated());
        var ids = org.mockito.ArgumentCaptor.forClass(UUID.class);
        verify(media).upload(eq(actor), ids.capture(), any());
        assertThat(ids.getValue()).isNotNull().isNotEqualTo(new UUID(0, 0));
    }

    @Test void composerPurposeIsExplicitAndUnknownValuesDoNotStartAnUpload() throws Exception {
        var file = file("file");
        mvc.perform(multipart("/api/files/upload").file(file).param("uploadId", upload.toString())
                        .param("purpose", "COMPOSER"))
                .andExpect(status().isCreated());
        verify(media).upload(actor, upload, file, UploadPurpose.COMPOSER);
        mvc.perform(multipart("/api/files/upload").file(file).param("purpose", "OTHER"))
                .andExpect(status().isBadRequest());
        verifyNoMoreInteractions(media);
    }

    @Test void batchValidatesEveryIdentityBeforeStartingAnyUpload() throws Exception {
        for (String[] ids : new String[][]{ {upload.toString()}, {upload.toString(), upload.toString()},
                {upload.toString(), new UUID(0, 0).toString()} }) {
            mvc.perform(multipart("/api/files/upload/multiple").file(file("files")).file(file("files")).param("uploadIds", ids))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(media);
    }

    @Test void orderedBatchIdsAreStablePerFile() throws Exception {
        UUID second = UUID.randomUUID(); var firstFile = file("files"); var secondFile = file("files");
        mvc.perform(multipart("/api/files/upload/multiple").file(firstFile).file(secondFile)
                .param("uploadIds", upload.toString(), second.toString())).andExpect(status().isCreated());
        var order = inOrder(media); order.verify(media).upload(actor, upload, firstFile); order.verify(media).upload(actor, second, secondFile);
    }

    @Test void statusEndpointIsOwnerScopedNoStoreAndDoesNotInventReadyData() throws Exception {
        when(media.inspectUpload(actor, upload)).thenReturn(new CloudinaryMediaService.UploadInspection(upload, CloudinaryMediaService.UploadState.PENDING, null));
        mvc.perform(get("/api/files/uploads/" + upload).param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.uploadId").value(upload.toString())).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.file").isEmpty());
        verify(media).inspectUpload(actor, upload);
    }

    @Test void failuresRemainErrorsAndDoNotBecomeSuccessfulPendingState() throws Exception {
        when(media.inspectUpload(actor, upload)).thenThrow(new NotFoundException("not owned"));
        mvc.perform(get("/api/files/uploads/" + upload)).andExpect(status().isNotFound());
        doThrow(new IllegalStateException("store unavailable")).when(media).inspectUpload(actor, upload);
        mvc.perform(get("/api/files/uploads/" + upload)).andExpect(status().isInternalServerError());
    }

    @Test void openApiDescribesActualInputIdentityAndInspectionStates() throws Exception {
        Map<?, ?> spec = new org.yaml.snakeyaml.Yaml().load(java.nio.file.Files.readString(java.nio.file.Path.of("..", "docs", "api", "openapi.yaml")));
        Map<?, ?> paths = (Map<?, ?>) spec.get("paths");
        assertThat(((Map<?, ?>) paths.get("/files/uploads/{uploadId}")).containsKey("get")).isTrue();
        Map<?, ?> schemas = (Map<?, ?>) ((Map<?, ?>) spec.get("components")).get("schemas");
        Map<?, ?> inspection = (Map<?, ?>) schemas.get("MediaUploadInspection");
        Map<?, ?> status = (Map<?, ?>) ((Map<?, ?>) inspection.get("properties")).get("status");
        assertThat(status.get("enum")).isEqualTo(java.util.List.of("PENDING", "READY", "QUARANTINED", "DELETING", "DELETED"));
        assertThat(inspection.get("required")).isEqualTo(java.util.List.of("uploadId", "status", "file"));
    }

    private static MockMultipartFile file(String part) { return new MockMultipartFile(part, "file.txt", "text/plain", new byte[]{1}); }
}
