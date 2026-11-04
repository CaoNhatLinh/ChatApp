package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.controller.CanonicalMessageController;
import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.*;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Actual routing, Bean Validation and JSON; service/storage are controlled. */
class MessagePinHttpContractTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), id = UUID.randomUUID();
    final MessageService service = mock(MessageService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final String path = "/api/conversations/" + room + "/messages";
    final org.springframework.test.web.servlet.MockMvc mvc;
    MessagePinHttpContractTest() {
        when(security.getCurrentUserId()).thenReturn(actor);
        mvc = MockMvcBuilders.standaloneSetup(new CanonicalMessageController(service, security))
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    }
    @Test void fullPinReadPreservesInt64DecimalStringAndNoStore() throws Exception {
        when(service.getMessagePins(actor, room)).thenReturn(new MessagePinStateView(room, "9223372036854775807", List.of()));
        mvc.perform(get(path + "/pins")).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.revision").value("9223372036854775807"))
                .andExpect(jsonPath("$.pins").isArray());
    }
    @Test void pinAndUnpinRequireAnExplicitExpectedRevision() throws Exception {
        for (var request : List.of(post(path + "/" + id + "/pin"), delete(path + "/" + id + "/pin"))) {
            mvc.perform(request.param("bucket", "2026-10-23-08:00").contentType("application/json").content("{}"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void malformedRevisionIsRejectedBeforeService() throws Exception {
        for (String revision : List.of("-1", "01", "1.5", "", "99999999999999999999")) {
            mvc.perform(post(path + "/" + id + "/pin").param("bucket", "2026-10-23-08:00")
                    .contentType("application/json").content("{\"expectedRevision\":\"" + revision + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void mutationReturnsTheFullVersionedSnapshotContract() throws Exception {
        var state = new MessagePinStateView(room, "8", List.of(new MessagePinReference(id, "2026-10-23-08:00")));
        when(service.pinMessage(actor, room, "2026-10-23-08:00", id, new MessagePinRequest("7")))
                .thenReturn(new MessagePinMutationView(null, state));
        mvc.perform(post(path + "/" + id + "/pin").param("bucket", "2026-10-23-08:00")
                .contentType("application/json").content("{\"expectedRevision\":\"7\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.pinState.revision").value("8"))
                .andExpect(jsonPath("$.pinState.pins[0].messageId").value(id.toString()));
        verify(service).pinMessage(actor, room, "2026-10-23-08:00", id, new MessagePinRequest("7"));
    }
}
