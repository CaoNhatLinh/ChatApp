package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.common.config.JacksonConfig;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.user.*;
import org.springframework.messaging.support.ExecutorSubscribableChannel;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real conversion and user-destination resolver, not live sockets/broker/datastore. */
class CallPrivateRoutingTest {
    @Test void stateRoutesOnlyToBothParticipantsSessionsAndRetainsTrustedInternalScope() throws Exception {
        var state = CallState.ringing(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                CallState.Type.VOICE, Instant.now(), UUID.randomUUID());
        var calls = mock(CallRepository.class);
        when(calls.publication(state.conversationId(), state.callId())).thenReturn(new CallRepository.Publication(state, 0));
        when(calls.markPublished(state, 0)).thenReturn(true);
        var broker = new ExecutorSubscribableChannel(); var sent = new ArrayList<Message<?>>(); broker.subscribe(sent::add);
        var messaging = new SimpMessagingTemplate(broker);
        var converter = new MappingJackson2MessageConverter();
        var mapper = new JacksonConfig().objectMapper(); converter.setObjectMapper(mapper); messaging.setMessageConverter(converter);
        assertThat(new CallStatePublisher(calls, messaging).publish(state)).isTrue();
        assertThat(sent).hasSize(3);
        assertThat(SimpMessageHeaderAccessor.getDestination(sent.get(0).getHeaders())).isEqualTo("/topic/conversation/" + state.conversationId() + "/calls");
        var registry = mock(SimpUserRegistry.class);
        var resolver = new DefaultUserDestinationResolver(registry);
        for (int index = 1; index <= 2; index++) {
            UUID recipient = index == 1 ? state.callerId() : state.calleeId();
            var user = mock(SimpUser.class); var one = mock(SimpSession.class); var two = mock(SimpSession.class);
            when(one.getId()).thenReturn(recipient + "-one"); when(two.getId()).thenReturn(recipient + "-two");
            when(user.getSessions()).thenReturn(Set.of(one, two)); when(registry.getUser(recipient.toString())).thenReturn(user);
            var message = sent.get(index);
            assertThat(SimpMessageHeaderAccessor.getDestination(message.getHeaders())).isEqualTo("/user/" + recipient + "/queue/calls");
            assertThat(CallDeliveryHeaders.read(message.getHeaders())).isEqualTo(CallDelivery.of(state, CallDelivery.Kind.STATE));
            var resolved = resolver.resolveDestination(message);
            assertThat(resolved).isNotNull();
            assertThat(resolved.getTargetDestinations()).containsExactlyInAnyOrder("/queue/calls-user" + recipient + "-one", "/queue/calls-user" + recipient + "-two");
            assertThat(resolved.getSubscribeDestination()).isEqualTo("/user/queue/calls");
            assertThat(message.getPayload()).isInstanceOf(byte[].class);
            var json = mapper.readTree((byte[]) message.getPayload());
            assertThat(json.get("action").asText()).isEqualTo("STATE");
            assertThat(json.get("state").get("callId").asText()).isEqualTo(state.callId().toString());
            assertThat(json.has("actorId") || json.has("signal") || json.has("noiCallRoom")).isFalse();
            var stomp = org.springframework.messaging.simp.stomp.StompHeaderAccessor.wrap(message);
            stomp.updateStompCommandAsServerMessage();
            stomp.setDestination(resolved.getSubscribeDestination());
            byte[] wire = new org.springframework.messaging.simp.stomp.StompEncoder().encode(stomp.getMessageHeaders(), (byte[]) message.getPayload());
            assertThat(new String(wire, java.nio.charset.StandardCharsets.UTF_8))
                    .contains("destination:/user/queue/calls")
                    .doesNotContain("noiCallRoom", "noiCallId", "noiCallRevision", "noiCallKind");
        }
        verify(registry).getUser(state.callerId().toString()); verify(registry).getUser(state.calleeId().toString());
        verifyNoMoreInteractions(registry);
    }
}
