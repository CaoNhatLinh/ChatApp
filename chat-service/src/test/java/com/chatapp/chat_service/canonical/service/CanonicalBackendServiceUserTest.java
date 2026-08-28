package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.security.jwt.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CanonicalBackendServiceUserTest {

    @Mock
    private CanonicalCqlStore store;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider tokenProvider;
    @Mock
    private CanonicalConversationRepository conversationRepository;
    @Mock
    private ConversationAuthorizationService authorization;
    @Mock
    private CanonicalEventRecorder eventRecorder;
    @Mock
    private ChatPolicyService chatPolicy;
    @Mock
    private SimpMessagingTemplate messaging;
    @Mock
    private AdminConversationDirectoryRepository adminConversationDirectory;

    @Test
    void userSearchReturnsBoundedPublicResultsAndCursor() {
        UUID actorId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(store.searchUsersByPrefix("al", null, null, 2)).thenReturn(List.of(
                new CanonicalCqlStore.UserDirectoryRow("alice", firstId, "Alice", "Alice", null, "ACTIVE"),
                new CanonicalCqlStore.UserDirectoryRow("alina", secondId, "Alina", "Alina", null, "ACTIVE")));

        var page = service().searchUsers(actorId, " Al ", 1, null);

        assertThat(page.content()).singleElement()
                .extracting(user -> user.userId())
                .isEqualTo(firstId);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
    }

    @Test
    void userSearchRejectsQueriesThatCannotUseThePrefixProjection() {
        assertThatThrownBy(() -> service().searchUsers(UUID.randomUUID(), "a", 20, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at least 2");
    }

    private CanonicalBackendService service() {
        return new CanonicalBackendService(
                store, passwordEncoder, tokenProvider, conversationRepository, authorization, eventRecorder, chatPolicy,
                messaging, adminConversationDirectory);
    }
}
