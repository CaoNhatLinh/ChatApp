package com.chatapp.chat_service.canonical.conversation;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.call.*;
import com.chatapp.chat_service.canonical.controller.*;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.message.*;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.moderation.ConversationBanService;
import com.chatapp.chat_service.canonical.repository.*;
import com.chatapp.chat_service.canonical.service.*;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.chatapp.chat_service.security.config.SecurityConfig;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.security.jwt.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import org.junit.jupiter.api.*;
import org.springframework.context.annotation.*;
import org.springframework.mock.web.MockServletContext;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import java.time.Instant;
import java.util.*;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;

/** Real MVC, security chain, signed JWT, actor extraction and services; storage boundaries are mocked. */
class ChatReadHttpSecurityTest {
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = Uuids.timeBased();
    final Instant now = Instant.parse("2026-10-20T08:00:00Z");
    final String bucket = "2026-10-20-08:00";
    AnnotationConfigWebApplicationContext context;
    MockMvc mvc;
    CanonicalCqlStore store;
    MessageRepository messages;
    String token;

    @BeforeEach void setup() {
        context = new AnnotationConfigWebApplicationContext();
        context.setServletContext(new MockServletContext());
        context.register(WebTestConfiguration.class);
        context.refresh();
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity())
                .defaultRequest(get("/").accept(org.springframework.http.MediaType.APPLICATION_JSON)).build();
        store = context.getBean(CanonicalCqlStore.class);
        messages = context.getBean(MessageRepository.class);
        when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(0, List.of()));
        var user = mock(CanonicalUser.class);
        when(user.accountStatus()).thenReturn("ACTIVE");
        when(context.getBean(UserRepository.class).findById(actor)).thenReturn(user);
        when(store.findConversationMember(room, actor)).thenReturn(new CanonicalConversationMember(
                room, actor, Set.of(), now, null, null, null, "INHERIT", messageId, now));
        token = context.getBean(JwtTokenProvider.class).generateToken("http-test", actor);
    }
    @AfterEach void close() { context.close(); }
    String path() { return "/api/conversations/" + room; }
    String bearer() { return "Bearer " + token; }

    @Test void anonymousCannotReadArchiveSourceOrReadPointer() throws Exception {
        for (String suffix : List.of("/summary", "/calls/active", "/shared-content", "/shared-content/" + messageId + "?bucket=" + bucket, "/read-state",
                "/messages/" + messageId + "/replies?bucket=" + bucket)) {
            mvc.perform(get(path() + suffix)).andExpect(status().isUnauthorized());
        }
        verifyNoInteractions(store, messages);
    }
    @Test void pointSummaryUsesSignedActorPreservesMemberStateAndDeniesRevokedMembership() throws Exception {
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationId()).thenReturn(room);
        when(conversation.conversationType()).thenReturn("GROUP");
        when(conversation.lastActivityAt()).thenReturn(now);
        when(store.findConversation(room)).thenReturn(conversation);
        when(store.findConversationProjectionAtActivity(actor, conversation)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionRow(conversation, true, 7, now, "MENTIONS", null, now));
        UUID forged = UUID.randomUUID();
        mvc.perform(get(path() + "/summary").header("Authorization", bearer()).param("userId", forged.toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.conversation.conversationId").value(room.toString()))
                .andExpect(jsonPath("$.pinned").value(true)).andExpect(jsonPath("$.unreadCount").value(7))
                .andExpect(jsonPath("$.notificationOverride").value("INHERIT"));
        verify(store, never()).findConversationMember(room, forged);
        when(store.findConversationProjectionAtActivity(actor, conversation)).thenReturn(null);
        mvc.perform(get(path() + "/summary").header("Authorization", bearer())).andExpect(status().isConflict());
        when(store.findConversationMember(room, actor)).thenReturn(null);
        mvc.perform(get(path() + "/summary").header("Authorization", bearer())).andExpect(status().isForbidden());
    }

    @Test void summaryHttpSerializesCurrentDeletedAuthorityNotRetainedProjection() throws Exception {
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationId()).thenReturn(room);
        when(conversation.conversationType()).thenReturn("GROUP");
        when(conversation.lastActivityAt()).thenReturn(now);
        when(store.findConversation(room)).thenReturn(conversation);
        var retained = new CanonicalCqlStore.LastMessageProjection(messageId, bucket, actor, "Sender",
                "Retained secret", "TEXT", now, false, true);
        when(store.findConversationProjectionAtActivity(actor, conversation)).thenReturn(
                new CanonicalCqlStore.ConversationProjectionRow(conversation, false, 1, now, "INHERIT", retained, now));
        var message = mock(CanonicalMessage.class);
        when(message.messageId()).thenReturn(messageId);
        when(message.messageBucket()).thenReturn(bucket);
        when(message.senderId()).thenReturn(actor);
        when(message.messageType()).thenReturn("TEXT");
        when(message.createdAt()).thenReturn(now);
        when(message.content()).thenReturn("Retained secret");
        when(message.isDeleted()).thenReturn(true);
        when(message.hasAttachments()).thenReturn(true);
        when(message.revision()).thenReturn(8);
        when(messages.find(room, bucket, messageId)).thenReturn(message);
        mvc.perform(get(path() + "/summary").header("Authorization", bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.lastMessage.revision").value(8))
                .andExpect(jsonPath("$.lastMessage.messageBucket").value(bucket))
                .andExpect(jsonPath("$.lastMessage.contentPreview").value(""))
                .andExpect(jsonPath("$.lastMessage.deleted").value(true))
                .andExpect(jsonPath("$.lastMessage.hasAttachments").value(false));
    }
    @Test void callLookupUsesSignedActorAndRechecksMembershipArchiveAndBlocks() throws Exception {
        UUID peer = UUID.randomUUID();
        var peerAccount = mock(CanonicalUser.class);
        when(peerAccount.accountStatus()).thenReturn("ACTIVE");
        when(context.getBean(UserRepository.class).findById(peer)).thenReturn(peerAccount);
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationType()).thenReturn("DM"); when(store.findConversation(room)).thenReturn(conversation);
        when(store.findConversationMember(room, peer)).thenReturn(mock(CanonicalConversationMember.class));
        var calls = context.getBean(CallRepository.class);
        String path = path() + "/calls/active";
        mvc.perform(get(path).header("Authorization", bearer())).andExpect(status().isNoContent());
        var call = CallState.ringing(room, UUID.randomUUID(), Uuids.timeBased(), peer, actor, CallState.Type.VOICE, Instant.now(), UUID.randomUUID());
        when(calls.slot(room)).thenReturn(new CallRepository.Slot(call.revision(), call.callId()));
        when(calls.find(room, call.callId())).thenReturn(call);
        mvc.perform(get(path).header("Authorization", bearer()).param("userId", peer.toString())).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.calleeId").value(actor.toString())).andExpect(jsonPath("$.status").value("RINGING"));
        when(context.getBean(FriendshipRepository.class).isBlocked(peer, actor)).thenReturn(true);
        mvc.perform(get(path).header("Authorization", bearer())).andExpect(status().isForbidden());
        when(conversation.isDeleted()).thenReturn(true);
        mvc.perform(get(path).header("Authorization", bearer())).andExpect(status().isNotFound());
        when(store.findConversationMember(room, actor)).thenReturn(null);
        mvc.perform(get(path).header("Authorization", bearer())).andExpect(status().isForbidden());
    }
    @Test void invalidOrRevokedAccountCannotReachCallAuthority() throws Exception {
        String path = path() + "/calls/active";
        mvc.perform(get(path).header("Authorization", "Bearer invalid-signature")).andExpect(status().isUnauthorized());
        when(context.getBean(UserRepository.class).findById(actor)).thenReturn(null);
        mvc.perform(get(path).header("Authorization", bearer())).andExpect(status().isUnauthorized());
        verifyNoInteractions(context.getBean(CallRepository.class), store);
    }
    @Test void signedActiveMemberCannotDiscoverCallWithUnavailablePeer() throws Exception {
        UUID peer = UUID.randomUUID();
        var conversation = mock(CanonicalConversation.class);
        when(conversation.conversationType()).thenReturn("DM");
        when(store.findConversation(room)).thenReturn(conversation);
        when(store.findConversationMember(room, peer)).thenReturn(mock(CanonicalConversationMember.class));
        var call = CallState.ringing(room, UUID.randomUUID(), Uuids.timeBased(), peer, actor, CallState.Type.VOICE, Instant.now(), UUID.randomUUID());
        var calls = context.getBean(CallRepository.class);
        when(calls.slot(room)).thenReturn(new CallRepository.Slot(call.revision(), call.callId()));
        when(calls.find(room, call.callId())).thenReturn(call);
        var peerAccount = mock(CanonicalUser.class);
        for (String unavailable : new String[]{"SUSPENDED", "BANNED", null}) {
            when(peerAccount.accountStatus()).thenReturn(unavailable);
            when(context.getBean(UserRepository.class).findById(peer)).thenReturn(unavailable == null ? null : peerAccount);
            mvc.perform(get(path() + "/calls/active").header("Authorization", bearer()))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"))
                    .andExpect(jsonPath("$.message").value("call participant is unavailable"));
        }
        verify(calls, never()).change(any(), any(), any());
    }
    @Test void signedMemberGetsOnlyTheirReadStateAndNoStoreHeaders() throws Exception {
        UUID forgedActor = UUID.randomUUID();
        mvc.perform(get(path() + "/read-state").header("Authorization", bearer()).param("userId", forgedActor.toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.lastReadMessageId").value(messageId.toString()))
                .andExpect(jsonPath("$.joinedAt").value(now.toString()));
        verify(store).findConversationMember(room, actor);
        verify(store, never()).findConversationMember(room, forgedActor);
        verifyNoInteractions(messages);
    }
    @Test void archiveRechecksMembershipOnEveryRequest() throws Exception {
        mvc.perform(get(path() + "/shared-content").header("Authorization", bearer()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.hasNext").value(false));
        when(store.findConversationMember(room, actor)).thenReturn(null);
        mvc.perform(get(path() + "/shared-content").header("Authorization", bearer()).param("cursor", "old-cursor"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }
    @Test void missingBucketIsClientErrorNotInternalServerError() throws Exception {
        mvc.perform(get(path() + "/shared-content/" + messageId).header("Authorization", bearer()))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("BAD_REQUEST"));
        verifyNoInteractions(messages);
    }
    @Test void malformedKindCursorOrSourceKeyAreClientErrors() throws Exception {
        mvc.perform(get(path() + "/shared-content").header("Authorization", bearer()).param("kind", "UNKNOWN"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path() + "/shared-content").header("Authorization", bearer()).param("cursor", "bad"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path() + "/shared-content/" + UUID.randomUUID()).header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(messages);
    }
    @Test void unavailableAccountCannotReuseValidSignedToken() throws Exception {
        when(context.getBean(UserRepository.class).findById(actor)).thenReturn(null);
        mvc.perform(get(path() + "/read-state").header("Authorization", bearer())).andExpect(status().isUnauthorized());
        verifyNoInteractions(store, messages);
    }

    @Test void sourceLookupUsesSignedActorAndRechecksBlockingMissingSourceAndMembership() throws Exception {
        UUID sender = UUID.randomUUID();
        var source = new CanonicalMessage(room, bucket, messageId, sender, "TEXT", "source text", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null, false, false, false, now, null, null, null, 0);
        when(messages.find(room, bucket, messageId)).thenReturn(source);
        mvc.perform(get(path() + "/shared-content/" + messageId).header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.messageId").value(messageId.toString()))
                .andExpect(jsonPath("$.content").value("source text"));
        when(context.getBean(FriendshipRepository.class).isBlocked(actor, sender)).thenReturn(true);
        mvc.perform(get(path() + "/shared-content/" + messageId).header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        when(messages.find(room, bucket, messageId)).thenReturn(null);
        mvc.perform(get(path() + "/shared-content/" + messageId).header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isNotFound());
        when(store.findConversationMember(room, actor)).thenReturn(null);
        mvc.perform(get(path() + "/shared-content/" + messageId).header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isForbidden());
    }

    @Test void invalidSignatureCannotReachReadServices() throws Exception {
        mvc.perform(get(path() + "/shared-content").header("Authorization", "Bearer invalid-signature"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(store, messages);
    }

    @Test void threadHttpUsesSignedActorNoStoreAndRechecksMembershipBeforeCursor() throws Exception {
        var parent = new CanonicalMessage(room, bucket, messageId, actor, "TEXT", "thread parent", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null, false, false, false, now, null, null, null, 0);
        when(messages.find(room, bucket, messageId)).thenReturn(parent);
        String threadPath = path() + "/messages/" + messageId + "/replies";
        mvc.perform(get(threadPath).header("Authorization", bearer()).param("bucket", bucket).param("userId", UUID.randomUUID().toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", containsString("no-store")))
                .andExpect(jsonPath("$.parent.messageId").value(messageId.toString()))
                .andExpect(jsonPath("$.content").isEmpty()).andExpect(jsonPath("$.hasNext").value(false));
        verify(messages).findReplies(room, bucket, messageId, null, 26);
        clearInvocations(messages);
        when(store.findConversationMember(room, actor)).thenReturn(null);
        mvc.perform(get(threadPath).header("Authorization", bearer()).param("bucket", bucket).param("cursor", "bad"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(messages);
    }

    @Test void threadHttpRejectsInvalidSourceAndPagingWithoutReadingMessages() throws Exception {
        String threadPath = path() + "/messages/" + messageId + "/replies";
        mvc.perform(get(threadPath).header("Authorization", bearer())).andExpect(status().isBadRequest());
        mvc.perform(get(threadPath).header("Authorization", bearer()).param("bucket", "2026-02-30-08:00"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(threadPath).header("Authorization", bearer()).param("bucket", bucket).param("limit", "51"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(threadPath).header("Authorization", bearer()).param("bucket", bucket).param("cursor", "bad"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(messages);
    }

    @Test void blockedThreadParentCannotExposeRepliesThroughHttp() throws Exception {
        UUID sender = UUID.randomUUID();
        var parent = new CanonicalMessage(room, bucket, messageId, sender, "TEXT", "blocked parent", "PLAIN",
                null, null, null, null, null, null, null, null, false, null, null, null, false, false, false, now, null, null, null, 0);
        when(messages.find(room, bucket, messageId)).thenReturn(parent);
        when(context.getBean(FriendshipRepository.class).isBlocked(actor, sender)).thenReturn(true);
        mvc.perform(get(path() + "/messages/" + messageId + "/replies").header("Authorization", bearer()).param("bucket", bucket))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("RESOURCE_NOT_FOUND"));
        verify(messages, never()).findReplies(any(), any(), any(), any(), anyInt());
    }

    @Configuration @EnableWebMvc @Import(SecurityConfig.class)
    static class WebTestConfiguration implements org.springframework.web.servlet.config.annotation.WebMvcConfigurer {
        @Override
        public void extendMessageConverters(List<org.springframework.http.converter.HttpMessageConverter<?>> converters) {
            var mapper = new com.chatapp.chat_service.common.config.JacksonConfig().objectMapper();
            converters.forEach(converter -> {
                if (converter instanceof org.springframework.http.converter.json.MappingJackson2HttpMessageConverter json) json.setObjectMapper(mapper);
            });
        }
        @Bean CanonicalCqlStore store() { return mock(CanonicalCqlStore.class); }
        @Bean MessageRepository messages() { return mock(MessageRepository.class); }
        @Bean UserRepository users() { return mock(UserRepository.class); }
        @Bean FriendshipRepository friends() { return mock(FriendshipRepository.class); }
        @Bean CallRepository calls() { return mock(CallRepository.class); }
        @Bean CallLifecycleService callLifecycle(CallRepository calls, CanonicalCqlStore store, FriendshipRepository friends, UserRepository users) {
            return new CallLifecycleService(calls, new ConversationAuthorizationService(store, mock(CanonicalConversationRepository.class)), store, friends, users);
        }
        @Bean CallQueryController callController(CallLifecycleService calls, SecurityContextHelper actor) { return new CallQueryController(calls, actor); }
        @Bean AppAuthorizationService appAuthorization() { return mock(AppAuthorizationService.class); }
        @Bean JwtTokenProvider tokens() {
            byte[] testKey = new byte[32]; new java.security.SecureRandom().nextBytes(testKey);
            return new JwtTokenProvider(Base64.getEncoder().encodeToString(testKey), 60000);
        }
        @Bean JwtAuthenticationFilter jwtFilter(JwtTokenProvider tokens, AppAuthorizationService auth, UserRepository users) {
            return new JwtAuthenticationFilter(tokens, auth, users);
        }
        @Bean SecurityContextHelper actor() { return new SecurityContextHelper(); }
        @Bean JwtAuthenticationEntryPoint entryPoint() { return new JwtAuthenticationEntryPoint(); }
        @Bean GlobalExceptionHandler errors() { return new GlobalExceptionHandler(); }
        @Bean SharedContentService content(CanonicalCqlStore store, MessageRepository messages, FriendshipRepository friends) {
            return new SharedContentService(store, messages, mock(MediaAssetRepository.class), friends);
        }
        @Bean SharedContentController shared(SharedContentService content, SecurityContextHelper actor) { return new SharedContentController(content, actor); }
        @Bean MessageThreadService threads(CanonicalCqlStore store, MessageRepository messages, FriendshipRepository friends) {
            return new MessageThreadService(new ConversationAuthorizationService(store, mock(CanonicalConversationRepository.class)), messages, friends);
        }
        @Bean MessageThreadController threadController(MessageThreadService threads, SecurityContextHelper actor) {
            return new MessageThreadController(threads, actor);
        }
        @Bean CanonicalConversationController conversations(CanonicalCqlStore store, UserRepository users, MessageRepository messages, SecurityContextHelper actor) {
            return new CanonicalConversationController(mock(ConversationService.class), new ConversationBrowseService(store, users, messages),
                    mock(ConversationRoleService.class), new ConversationAuthorizationService(store, mock(CanonicalConversationRepository.class)),
                    mock(RoomAuditService.class), mock(ConversationBanService.class), actor);
        }
    }
}
