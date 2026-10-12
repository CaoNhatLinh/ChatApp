package com.chatapp.chat_service.canonical.poll;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.messaging.MessageSender;
import com.chatapp.chat_service.canonical.messaging.RealtimePublisher;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalPoll;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PollServiceRecoveryTest {
    @Test
    void repairsExistingPollBeforeReadingItsAggregateAndRebroadcastsReadyState() {
        PollRepository polls = mock(PollRepository.class);
        MessageSender messages = mock(MessageSender.class);
        RealtimePublisher realtime = mock(RealtimePublisher.class);
        UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), client = UUID.randomUUID(), id = UUID.randomUUID();
        CanonicalPoll existing = new CanonicalPoll(id, room, "2026-10-03-01:00", UUID.randomUUID(),
                "Where?", List.of("Here", "There"), false, false, false, actor, Instant.now(), null, null, null);
        CanonicalMessage message = new CanonicalMessage(room, existing.messageBucket(), existing.messageId(), actor,
                "POLL", "Where?", "PLAIN", null, null, null, id, null, null, null, null,
                false, null, null, null, false, false, false, existing.createdAt(), client);
        when(messages.sendMessage(eq(actor), eq(room), any())).thenReturn(message);
        when(polls.findById(any())).thenReturn(existing);
        when(polls.findStates(List.of(id), actor)).thenReturn(Map.of(id,
                new PollRepository.PollState(Map.of(0, 0L, 1, 0L), Set.of(), 0)));
        PollService service = new PollService(polls, mock(ConversationAuthorizationService.class),
                mock(CanonicalEventRecorder.class), realtime, messages);
        service.create(actor, new CanonicalApiContracts.PollCreateRequest(room, client,
                "Where?", List.of("Here", "There"), false, false, null));
        var ordered = inOrder(polls);
        ordered.verify(polls).create(existing);
        ordered.verify(polls).findStates(List.of(id), actor);
        verify(realtime).publishToConversation(eq(room), eq("/polls"), any());
    }
}
