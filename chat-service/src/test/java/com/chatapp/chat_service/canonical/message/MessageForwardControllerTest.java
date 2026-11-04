package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.controller.MessageForwardSourceController;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.Instant;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Standalone binding/serialization test; not a live authentication or datastore test. */
class MessageForwardControllerTest {
    @Test void bindsCurrentActorAndFullDestinationKeyWithoutSerializingPrivateForwardChain() throws Exception {
        var sources = mock(MessageForwardSourceService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = Uuids.timeBased(), sourceRoom = UUID.randomUUID();
        String bucket = "2026-10-20-08:03";
        var source = new CanonicalMessage(sourceRoom, bucket, Uuids.timeBased(), UUID.randomUUID(), "TEXT", "source", "PLAIN",
                null, null, null, null, null, UUID.randomUUID(), bucket, Uuids.timeBased(), false, null,
                null, null, true, false, false, Instant.now(), UUID.randomUUID(), null, null, 0);
        when(security.getCurrentUserId()).thenReturn(actor);
        when(sources.get(actor, room, bucket, id)).thenReturn(new MessageForwardSourceService.Source(true, source),
                new MessageForwardSourceService.Source(false, null));
        var forwards = mock(MessageForwardPolicy.class);
        var mvc = MockMvcBuilders.standaloneSetup(new MessageForwardSourceController(sources, security, forwards))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
        String path = "/api/conversations/" + room + "/messages/" + id + "/forward-source";
        mvc.perform(get(path).param("bucket", bucket)).andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.source.conversationId").value(sourceRoom.toString()))
                .andExpect(jsonPath("$.source.forwarded").value(true))
                .andExpect(jsonPath("$.source.forwardedFromConversationId").doesNotExist())
                .andExpect(jsonPath("$.source.forwardedFromMessageId").doesNotExist());
        mvc.perform(get(path).param("bucket", bucket)).andExpect(status().isOk())
                .andExpect(jsonPath("$.available").value(false)).andExpect(jsonPath("$.source").doesNotExist());
        verify(sources, times(2)).get(actor, room, bucket, id);
        mvc.perform(get(path)).andExpect(status().isBadRequest());
        verifyNoMoreInteractions(sources);
        var attachment = new com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalAttachment(
                UUID.randomUUID(), UUID.randomUUID(), "CLOUDINARY", "image-key", "image.png", "image/png",
                120L, 320, 180, null, null, false);
        when(forwards.prepare(actor, sourceRoom, bucket, source.messageId()))
                .thenReturn(new MessageForwardPolicy.Draft(source, java.util.List.of(attachment)));
        mvc.perform(get("/api/conversations/" + sourceRoom + "/messages/" + source.messageId() + "/forward-draft").param("bucket", bucket))
                .andExpect(status().isOk()).andExpect(jsonPath("$.message.messageId").value(source.messageId().toString()))
                .andExpect(jsonPath("$.attachments[0].assetId").value(attachment.assetId().toString()))
                .andExpect(jsonPath("$.attachments[0].width").value(320))
                .andExpect(jsonPath("$.attachments[0].height").value(180))
                .andExpect(jsonPath("$.message.forwardedFromConversationId").doesNotExist());
        verify(forwards).prepare(actor, sourceRoom, bucket, source.messageId());
    }
}
