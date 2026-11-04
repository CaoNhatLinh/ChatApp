package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.controller.MessageAttachmentController;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.yaml.snakeyaml.Yaml;
import java.nio.file.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MessageAttachmentControllerTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), message = UUID.randomUUID(), attachment = UUID.randomUUID();
    final String bucket = "2026-10-23-00:00";
    final String path = "/api/conversations/" + room + "/messages/" + message + "/attachments";
    final MessageAttachmentReader reader = mock(MessageAttachmentReader.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final org.springframework.test.web.servlet.MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new MessageAttachmentController(reader, security)).setControllerAdvice(new GlobalExceptionHandler())
            .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    MessageAttachmentControllerTest() { when(security.getCurrentUserId()).thenReturn(actor); }

    @Test void memberScopedReadUsesAuthenticatedActorAndCanonicalJsonNoStore() throws Exception {
        var item = new MessageAttachmentReader.Item(attachment, UUID.randomUUID(), "photo.png", "image/png", 64L,
                2, 3, null, false, MessageAttachmentReader.Status.READY, "https://cdn.example/photo.png", null);
        when(reader.list(actor, room, bucket, message, 25, null)).thenReturn(new MessageAttachmentReader.Page(room, bucket, message, List.of(item), null, false));
        mvc.perform(get(path).param("bucket", bucket).param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.conversationId").value(room.toString()))
                .andExpect(jsonPath("$.messageId").value(message.toString()))
                .andExpect(jsonPath("$.content[0].status").value("READY"))
                .andExpect(jsonPath("$.content[0].url").value(item.url()))
                .andExpect(jsonPath("$.content[0].byteSize").value(64))
                .andExpect(jsonPath("$.hasNext").value(false));
        verify(reader).list(actor, room, bucket, message, 25, null);
        verifyNoMoreInteractions(reader);
    }
    @Test void bindsCursorAndDoesNotTurnStorageOrAuthorizationErrorsIntoEmptySuccess() throws Exception {
        when(reader.list(actor, room, bucket, message, 1, attachment)).thenThrow(new ForbiddenException("not member"));
        mvc.perform(get(path).param("bucket", bucket).param("limit", "1").param("cursor", attachment.toString()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        when(reader.list(actor, room, bucket, message, 25, null)).thenThrow(new NotFoundException("message attachments unavailable"));
        mvc.perform(get(path).param("bucket", bucket)).andExpect(status().isNotFound());
        doThrow(new IllegalStateException("store unavailable")).when(reader).list(actor, room, bucket, message, 25, null);
        mvc.perform(get(path).param("bucket", bucket)).andExpect(status().isInternalServerError());
    }
    @Test void missingBucketAndMalformedUuidFailBeforeReader() throws Exception {
        mvc.perform(get(path)).andExpect(status().isBadRequest());
        mvc.perform(get(path).param("bucket", bucket).param("cursor", "not-uuid")).andExpect(status().isBadRequest());
        verifyNoInteractions(reader);
    }
    @Test void openApiDeclaresTheSingleMemberScopedReadContract() throws Exception {
        Map<?, ?> doc = new Yaml().load(Files.readString(Path.of("../docs/api/openapi.yaml")));
        Map<?, ?> paths = (Map<?, ?>) doc.get("paths");
        assertThat(paths.containsKey("/conversations/{conversationId}/messages/{messageId}/attachments")).isTrue();
        Map<?, ?> schemas = (Map<?, ?>) ((Map<?, ?>) doc.get("components")).get("schemas");
        assertThat(schemas.containsKey("MessageAttachmentPage")).isTrue();
        assertThat(((Map<?, ?>) schemas.get("MessageAttachmentView")).get("required")).isEqualTo(List.of("attachmentId", "fileName", "mimeType", "byteSize", "spoiler", "status"));
    }
}
