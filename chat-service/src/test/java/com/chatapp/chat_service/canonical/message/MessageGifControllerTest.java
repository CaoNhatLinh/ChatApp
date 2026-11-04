package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.controller.CanonicalMessageController;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.Instant;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MessageGifControllerTest {
    @Test void canonicalHttpSendAndPointReadPreserveGifIdentityAndUseCurrentActor() throws Exception {
        var messages = mock(MessageService.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = UUID.randomUUID(), client = UUID.randomUUID();
        String bucket = "2026-10-20-08:00";
        var reference = new GifReference("GIPHY", "abc123");
        var message = new CanonicalMessage(room, bucket, id, actor, "GIF", "", "PLAIN", null, null, null, null,
                null, null, null, null, false, null, null, null, false, false, false, Instant.now(), client, reference, null, 0);
        when(security.getCurrentUserId()).thenReturn(actor);
        when(messages.sendMessage(eq(actor), eq(room), any())).thenReturn(message);
        when(messages.getMessage(actor, room, bucket, id)).thenReturn(message);
        var mvc = MockMvcBuilders.standaloneSetup(new CanonicalMessageController(messages, security))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
        mvc.perform(post("/api/conversations/" + room + "/messages").contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON).content("""
                    {"clientMessageId":"%s","messageType":"GIF","content":"","contentFormat":"PLAIN",
                     "gif":{"provider":"GIPHY","providerGifId":"abc123"}}
                    """.formatted(client)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.gif.provider").value("GIPHY"))
                .andExpect(jsonPath("$.gif.providerGifId").value("abc123"));
        verify(messages).sendMessage(eq(actor), eq(room), argThat((MessageSendRequest request) ->
                client.equals(request.clientMessageId()) && reference.equals(request.gif()) && request.content().isEmpty()));
        mvc.perform(get("/api/conversations/" + room + "/messages/" + id).param("bucket", bucket).accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk()).andExpect(jsonPath("$.gif.providerGifId").value("abc123"));
    }
}
