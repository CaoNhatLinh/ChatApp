package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.media.ManagedImageReference;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.controller.CanonicalConversationController;
import com.chatapp.chat_service.canonical.conversation.ConversationBrowseService;
import com.chatapp.chat_service.canonical.moderation.ConversationBanService;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.*;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.UUID;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class CommunityCreationPolicyHttpTest {
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final SystemSettingsService settings = mock(SystemSettingsService.class);
    private final SecurityContextHelper security = mock(SecurityContextHelper.class);

    private org.springframework.test.web.servlet.MockMvc mvc() {
        var service = new ConversationService(store, mock(CanonicalConversationRepository.class),
                mock(ConversationAuthorizationService.class), mock(CanonicalEventRecorder.class),
                mock(AdminConversationDirectoryRepository.class), mock(UserRepository.class),
                mock(ConversationMembershipService.class), settings, mock(ManagedImageReference.class));
        var controller = new CanonicalConversationController(service, mock(ConversationBrowseService.class),
                mock(ConversationRoleService.class), mock(ConversationAuthorizationService.class),
                mock(RoomAuditService.class), mock(ConversationBanService.class), security);
        return MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new GlobalExceptionHandler())
                .setMessageConverters(new MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper())).build();
    }

    @Test void pausedCommunityHasAStablePolicyCodeWithoutAnyPersistence() throws Exception {
        when(security.getCurrentUserId()).thenReturn(UUID.randomUUID());
        when(settings.communityDefaults()).thenReturn(new SystemSettingsService.CommunityDefaults(false, 250));
        mvc().perform(post("/api/conversations").contentType(MediaType.APPLICATION_JSON)
                .content("{\"conversationType\":\"CHANNEL\",\"visibility\":\"COMMUNITY\",\"name\":\"Studio\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("COMMUNITY_CREATION_DISABLED"))
                .andExpect(jsonPath("$.path").value("/api/conversations"));
        verifyNoInteractions(store);
    }

    @Test void ordinaryForbiddenDoesNotMasqueradeAsPausedCommunity() throws Exception {
        mvc().perform(post("/api/conversations").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        verifyNoInteractions(store, settings);
    }
}
