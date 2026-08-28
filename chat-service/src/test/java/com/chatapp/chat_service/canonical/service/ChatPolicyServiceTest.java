package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.moderation.ModerationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.junit.jupiter.api.BeforeEach;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ChatPolicyServiceTest {
    private StringRedisTemplate redis;
    private CanonicalCqlStore store;
    private ModerationRepository moderation;
    private ChatPolicyService policy;

    @BeforeEach
    void setUp() {
        redis = mock(StringRedisTemplate.class);
        store = mock(CanonicalCqlStore.class);
        moderation = mock(ModerationRepository.class);
        policy = new ChatPolicyService(redis, store, moderation);
    }

    @Test
    void mutedMemberCannotSendButNonMessageActionsRemainOutsideThisPolicy() {
        CanonicalConversation conversation = conversation("OPEN");
        CanonicalConversationMember member = member(conversation.conversationId(), Instant.now().plusSeconds(60));

        assertThatThrownBy(() -> policy.enforceSend(
                conversation, member, Set.of(ConversationPermission.MESSAGE_SEND), UUID.randomUUID()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("muted until");
    }

    @Test
    void roomManagerCanSendWhileConversationChatIsRestricted() {
        CanonicalConversation conversation = conversation("MANAGERS_ONLY");

        assertThatCode(() -> policy.enforceSend(
                conversation,
                member(conversation.conversationId(), null),
                Set.of(ConversationPermission.MESSAGE_SEND, ConversationPermission.ROOM_UPDATE),
                UUID.randomUUID()))
                .doesNotThrowAnyException();
    }

    @Test
    void activeApplicationSanctionBlocksSend() {
        CanonicalCqlStore store = mock(CanonicalCqlStore.class);
        ModerationRepository moderation = mock(ModerationRepository.class);
        when(moderation.hasActiveAppSanction(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        ChatPolicyService sanctionedPolicy = new ChatPolicyService(mock(StringRedisTemplate.class), store, moderation);

        assertThatThrownBy(() -> sanctionedPolicy.enforceSend(
                conversation("OPEN"), member(UUID.randomUUID(), null),
                Set.of(ConversationPermission.MESSAGE_SEND), UUID.randomUUID()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("application sanction");
    }

    @Test
    void conversationBanBlocksSend() {
        CanonicalCqlStore store = mock(CanonicalCqlStore.class);
        when(store.isConversationBanned(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(true);
        ChatPolicyService bannedPolicy = new ChatPolicyService(mock(StringRedisTemplate.class), store, mock(ModerationRepository.class));

        assertThatThrownBy(() -> bannedPolicy.enforceSend(
                conversation("OPEN"), member(UUID.randomUUID(), null),
                Set.of(ConversationPermission.MESSAGE_SEND), UUID.randomUUID()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("banned");
    }

    private CanonicalConversation conversation(String chatMode) {
        UUID id = UUID.randomUUID();
        return new CanonicalConversation(
                id, "GROUP", "PRIVATE_LINK", "INVITE_ONLY", "Room", "room", null, null, null,
                UUID.randomUUID(), UUID.randomUUID(), Instant.now(), Instant.now(), false, null,
                chatMode, 5, null, "ALL", null, Set.of(), "vi", 100, 2, false, Instant.now());
    }

    private CanonicalConversationMember member(UUID conversationId, Instant mutedUntil) {
        return new CanonicalConversationMember(
                conversationId, UUID.randomUUID(), Set.of(), Instant.now(), null, mutedUntil,
                null, "INHERIT", null, null);
    }
}
