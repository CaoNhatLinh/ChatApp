package com.chatapp.chat_service.realtime;

import com.chatapp.chat_service.canonical.call.CallSignalingService;
import com.chatapp.chat_service.canonical.call.CallSignalingService.*;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.messaging.Message;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.*;
import org.springframework.messaging.simp.annotation.support.SimpAnnotationMethodMessageHandler;
import org.springframework.messaging.support.ExecutorSubscribableChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.util.MimeTypeUtils;
import org.yaml.snakeyaml.Yaml;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class CallControllerTest {
    final CallSignalingService calls = mock(CallSignalingService.class);
    final SecurityContextHelper security = mock(SecurityContextHelper.class);
    final CallController controller = new CallController(calls, security);
    final UUID actor = UUID.randomUUID();
    final UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(actor.toString(), "", List.of());

    @Test void rejectsMissingAndUnauthenticatedPrincipalBeforeDispatch() {
        assertThatThrownBy(() -> controller.start(null, null)).isInstanceOf(IllegalArgumentException.class);
        var anonymous = new UsernamePasswordAuthenticationToken("anonymous", "");
        assertThatThrownBy(() -> controller.start(null, anonymous)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(calls, security);
    }
    @Test @SuppressWarnings("unchecked")
    void wireContractMatchesEveryCommandAndRequiredResultField() throws Exception {
        Map<String, Object> contract = new Yaml().load(Files.readString(Path.of("..", "docs", "api", "asyncapi.yaml")));
        var channels = (Map<String, Map<String, Object>>) contract.get("channels");
        var addresses = channels.values().stream().map(channel -> channel.get("address")).toList();
        for (Action action : Action.values()) assertThat(addresses).contains("/app/call." + action.name().toLowerCase(Locale.ROOT));
        assertThat(addresses).contains("/user/queue/call-results");
        assertThat(addresses).contains("/user/queue/calls");
        var components = (Map<String, Object>) contract.get("components");
        var messages = (Map<String, Map<String, Object>>) components.get("messages");
        assertThat((Map<String, Object>) messages.get("CallStateUpdate").get("payload"))
                .containsEntry("$ref", "#/components/schemas/CallStateEvent");
        var result = (Map<String, Object>) messages.get("CallResult").get("payload");
        assertThat((List<String>) result.get("required")).containsExactlyInAnyOrder(Arrays.stream(Result.class.getRecordComponents()).map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new));
        var command = (Map<String, Object>) messages.get("CallCommand").get("payload");
        assertThat((List<String>) command.get("required")).contains("requestId", "conversationId", "callId", "targetUserId");
        var properties = (Map<String, Object>) command.get("properties");
        assertThat(properties).doesNotContainKeys("actorId", "mediaRegion", "maxParticipants");
        var schemas = (Map<String, Map<String, Object>>) components.get("schemas");
        var stateEvent = schemas.get("CallStateEvent");
        assertThat((List<String>) stateEvent.get("required")).containsExactlyInAnyOrder(
                Arrays.stream(com.chatapp.chat_service.canonical.call.CallStatePublisher.Event.class.getRecordComponents())
                        .map(java.lang.reflect.RecordComponent::getName).toArray(String[]::new));
        assertThat((Map<String, Object>) stateEvent.get("properties")).doesNotContainKeys("actorId", "targetUserId", "signal");
        assertThat(stateEvent.get("additionalProperties")).isEqualTo(false);
        assertThat((List<String>) schemas.get("CallSignalEvent").get("required")).contains("actorId", "targetUserId", "signal");
    }
    @Test void actualSpringMappingsConvertJsonAndRestrictResultsToTheOriginatingSession() throws Exception {
        var inbound = new ExecutorSubscribableChannel(); var outbound = new ExecutorSubscribableChannel();
        var broker = new ExecutorSubscribableChannel(); var result = new AtomicReference<Message<?>>();
        broker.subscribe(result::set);
        var mapper = new ObjectMapper().findAndRegisterModules();
        var converter = new MappingJackson2MessageConverter(); converter.setObjectMapper(mapper);
        var template = new SimpMessagingTemplate(broker); template.setMessageConverter(converter);
        try (var context = new StaticApplicationContext()) {
            context.getBeanFactory().registerSingleton("callController", controller); context.refresh();
            var handler = new SimpAnnotationMethodMessageHandler(inbound, outbound, template);
            handler.setApplicationContext(context); handler.setDestinationPrefixes(List.of("/app")); handler.setMessageConverter(converter);
            handler.afterPropertiesSet(); handler.start();
            try {
                when(security.getCurrentUserId(authentication)).thenReturn(actor);
                for (Action action : Action.values()) {
                    result.set(null);
                    var command = new Command(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "VOICE", UUID.randomUUID(), null);
                    var expected = new Result(command.requestId(), command.conversationId(), command.callId(), action, false, "CONFLICT", null);
                    when(calls.execute(actor, action, command)).thenReturn(expected);
                    var headers = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
                    headers.setDestination("/app/call." + action.name().toLowerCase(Locale.ROOT));
                    headers.setSessionId("originating-session"); headers.setUser(authentication);
                    headers.setSessionAttributes(new HashMap<>());
                    headers.setContentType(MimeTypeUtils.APPLICATION_JSON);
                    handler.handleMessage(MessageBuilder.createMessage(mapper.writeValueAsBytes(command), headers.getMessageHeaders()));
                    verify(calls).execute(actor, action, command);
                    assertThat(result.get()).as("private result for %s", action).isNotNull();
                    var sent = SimpMessageHeaderAccessor.wrap(result.get());
                    assertThat(sent.getDestination()).isEqualTo("/user/" + actor + "/queue/call-results");
                    assertThat(sent.getSessionId()).isEqualTo("originating-session");
                    assertThat(mapper.readValue((byte[]) result.get().getPayload(), Result.class)).isEqualTo(expected);
                }
            } finally { handler.stop(); }
        }
    }
}
