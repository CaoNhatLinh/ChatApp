package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.common.config.JacksonConfig;
import com.chatapp.chat_service.canonical.controller.CanonicalMessageController;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.*;
import com.chatapp.chat_service.canonical.repository.*;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.service.*;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.poll.PollRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import com.chatapp.chat_service.common.exception.GlobalExceptionHandler;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.*;
import com.datastax.oss.driver.api.core.metadata.schema.KeyspaceMetadata;
import com.datastax.oss.driver.api.core.type.UserDefinedType;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class MessageRevisionContractTest {
    final CqlSession session = mock(CqlSession.class, RETURNS_DEEP_STUBS);
    final Row row = mock(Row.class);
    final UUID room = UUID.randomUUID(), id = UUID.randomUUID(), actor = UUID.randomUUID();
    final CassandraMessageRepository repository;
    MessageRevisionContractTest() {
        var keyspace = mock(KeyspaceMetadata.class);
        when(session.getMetadata().getKeyspace("chat_app")).thenReturn(Optional.of(keyspace));
        when(keyspace.getUserDefinedType("attachment_ref")).thenReturn(Optional.of(mock(UserDefinedType.class)));
        when(session.prepare(anyString())).thenReturn(mock(PreparedStatement.class, RETURNS_DEEP_STUBS));
        var load = mock(PreparedStatement.class);
        var statement = mock(BoundStatement.class, RETURNS_SELF);
        when(session.prepare(argThat((String query) -> query.stripLeading().startsWith("SELECT * FROM messages_by_conversation_bucket")
                && query.contains("AND message_id = ?")))).thenReturn(load);
        when(load.bind(room, "2026-10-23-08:00", id)).thenReturn(statement);
        when(session.execute(statement).one()).thenReturn(row);
        when(row.getInt("revision_no")).thenReturn(7);
        when(row.getUuid("conversation_id")).thenReturn(room);
        when(row.getUuid("message_id")).thenReturn(id);
        when(row.getUuid("sender_id")).thenReturn(actor);
        when(row.getString("message_bucket")).thenReturn("2026-10-23-08:00");
        when(row.getString("message_type")).thenReturn("TEXT");
        when(row.getInstant("created_at")).thenReturn(java.time.Instant.now());
        repository = new CassandraMessageRepository(session);
    }
    @Test void storedRevisionIsExposedInCanonicalHttpJson() {
        var message = repository.find(room, "2026-10-23-08:00", id);
        var json = new JacksonConfig().objectMapper().valueToTree(message);
        assertThat(json.path("revision").asInt(-1)).isEqualTo(7);
    }
    @Test void publicDeletionRedactionPreservesRevisionAndRemovesRetainedContent() {
        when(row.getBoolean("is_deleted")).thenReturn(true);
        when(row.getString("content")).thenReturn("retained private content");
        var json = new JacksonConfig().objectMapper().valueToTree(PublicMessageView.redact(repository.find(room, "2026-10-23-08:00", id)));
        assertThat(json.path("revision").asInt(-1)).isEqualTo(7);
        assertThat(json.path("content").asText()).isEmpty();
    }
    @Test void missingAndNegativeStoredRevisionAreErrorsNotInventedZero() {
        when(row.isNull("revision_no")).thenReturn(true);
        assertThatThrownBy(() -> repository.find(room, "2026-10-23-08:00", id)).isInstanceOf(IllegalStateException.class);
        when(row.isNull("revision_no")).thenReturn(false);
        when(row.getInt("revision_no")).thenReturn(-1);
        assertThatThrownBy(() -> repository.find(room, "2026-10-23-08:00", id)).isInstanceOf(IllegalStateException.class);
    }
    @Test void actualHttpControllerSerializesAuthorityRevision() throws Exception {
        var authority = repository.find(room, "2026-10-23-08:00", id);
        var service = mock(MessageService.class); var security = mock(SecurityContextHelper.class);
        when(security.getCurrentUserId()).thenReturn(actor);
        when(service.getMessage(actor, room, authority.messageBucket(), id)).thenReturn(authority);
        var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders
                .standaloneSetup(new CanonicalMessageController(service, security))
                .setMessageConverters(new org.springframework.http.converter.json.MappingJackson2HttpMessageConverter(new JacksonConfig().objectMapper()))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/api/conversations/" + room + "/messages/" + id).param("bucket", authority.messageBucket()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision").value(7));
        verify(service).getMessage(actor, room, authority.messageBucket(), id);
    }
    @Test void actualDeletePublishesTheSameRedactedAuthorityRevision() {
        var before = repository.find(room, "2026-10-23-08:00", id);
        when(row.getInt("revision_no")).thenReturn(8);
        when(row.getBoolean("is_deleted")).thenReturn(true);
        when(row.getString("content")).thenReturn("retained private content");
        var deleted = repository.find(room, "2026-10-23-08:00", id);
        var messages = mock(MessageRepository.class);
        when(messages.find(room, before.messageBucket(), id)).thenReturn(before, deleted);
        when(messages.delete(room, before.messageBucket(), id, actor)).thenReturn(true);
        when(messages.findPinState(room)).thenReturn(new MessageRepository.PinState(0, List.of()));
        var realtime = mock(RealtimePublisher.class); var recorder = mock(CanonicalEventRecorder.class);
        var service = new MessageService(mock(CanonicalCqlStore.class), mock(CanonicalConversationRepository.class),
                mock(ConversationAuthorizationService.class), recorder, mock(ChatPolicyService.class), realtime,
                mock(NotificationService.class), mock(PollRepository.class), messages, mock(UserRepository.class),
                mock(MessageAttachmentPolicy.class), mock(MessageStickerPolicy.class), mock(MessageReplyPolicy.class), mock(MessageForwardPolicy.class));
        assertThat(service.deleteMessage(actor, room, before.messageBucket(), id).revision()).isEqualTo(8);
        verify(realtime).publishToConversation(eq(room), eq(""), argThat(payload -> payload instanceof Map<?, ?> map
                && Integer.valueOf(8).equals(map.get("revision")) && Boolean.TRUE.equals(map.get("isDeleted")) && "".equals(map.get("content"))));
        verify(recorder).record(eq(actor), eq(room), eq("MESSAGE_DELETE"), eq("message"), eq(id.toString()),
                isNull(), isNull(), any(), any(), argThat(payload -> Integer.valueOf(8).equals(payload.get("revision"))));
    }
    @Test void openApiAndRealtimeSchemasRequireTheSameBoundedRevision() throws Exception {
        for (String file : List.of("openapi.yaml", "asyncapi.yaml")) {
            Map<?, ?> doc = new org.yaml.snakeyaml.Yaml().load(java.nio.file.Files.readString(java.nio.file.Path.of("../docs/api/" + file)));
            var schemas = (Map<?, ?>) ((Map<?, ?>) doc.get("components")).get("schemas");
            var schema = (Map<?, ?>) schemas.get(file.startsWith("open") ? "Message" : "MessageEvent");
            assertThat(((List<?>) schema.get("required")).contains("revision")).isTrue();
            var revision = (Map<?, ?>) ((Map<?, ?>) schema.get("properties")).get("revision");
            assertThat(revision.get("minimum")).isEqualTo(0);
            assertThat(revision.get("maximum")).isEqualTo(Integer.MAX_VALUE);
        }
    }
}
