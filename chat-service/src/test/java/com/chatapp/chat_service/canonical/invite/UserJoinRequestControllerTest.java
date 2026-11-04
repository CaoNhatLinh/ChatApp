package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.controller.UserJoinRequestController;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class UserJoinRequestControllerTest {
    @Test
    void clientCannotChooseUserAndPrivateResponseIsNotCached() throws Exception {
        var repository = mock(UserJoinRequestRepository.class);
        var security = mock(SecurityContextHelper.class);
        UUID actor = UUID.randomUUID();
        when(security.getCurrentUserId()).thenReturn(actor);
        when(repository.list(actor, null, 25)).thenReturn(new UserJoinRequestRepository.Page(List.of(), null, false));
        var mvc = MockMvcBuilders.standaloneSetup(new UserJoinRequestController(repository, security)).build();
        mvc.perform(get("/api/me/join-requests").accept(org.springframework.http.MediaType.APPLICATION_JSON)
                        .param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.hasNext").value(false));
        verify(repository).list(actor, null, 25);
        verifyNoMoreInteractions(repository);
    }
}
