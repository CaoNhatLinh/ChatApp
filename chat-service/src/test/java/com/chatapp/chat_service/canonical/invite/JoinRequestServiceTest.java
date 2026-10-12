package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.JoinRequestView;
import com.chatapp.chat_service.canonical.notification.NotificationService;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.service.ConversationMembershipService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class JoinRequestServiceTest {
    private final CanonicalCqlStore store = mock(CanonicalCqlStore.class);
    private final InviteRepository invites = mock(InviteRepository.class);
    private final JoinRequestService service = new JoinRequestService(store, invites,
            mock(ConversationAuthorizationService.class), mock(ConversationMembershipService.class),
            mock(CanonicalEventRecorder.class), mock(NotificationService.class));
    private final UUID actor = UUID.randomUUID();
    private final UUID conversation = UUID.randomUUID();

    @Test
    void mergedCursorKeepsSubMillisecondRequestsOnTheNextPage() {
        UUID older = UUID.fromString("00000001-0000-1000-8000-000000000001");
        UUID newer = UUID.fromString("00000002-0000-1000-8000-000000000001");
        when(invites.listRequests(conversation, null, 2)).thenReturn(List.of(view(older)));
        when(store.listCommunityJoinRequests(conversation, null, 2)).thenReturn(List.of(view(newer)));

        var first = service.list(actor, conversation, null, 1);
        assertThat(first.content()).extracting(JoinRequestView::requestedAt).containsExactly(newer);
        assertThat(first.nextCursor()).isEqualTo(newer);
        when(invites.listRequests(conversation, newer, 2)).thenReturn(List.of(view(older)));
        when(store.listCommunityJoinRequests(conversation, newer, 2)).thenReturn(List.of());
        var second = service.list(actor, conversation, first.nextCursor(), 1);
        assertThat(second.content()).extracting(JoinRequestView::requestedAt).containsExactly(older);
        assertThat(second.hasNext()).isFalse();
        assertThat(second.nextCursor()).isNull();
    }

    @Test
    void equalTimestampsUseCassandraSignedByteOrderForTheNodeAndClock() {
        UUID lower = UUID.fromString("00000001-0000-1000-8080-000000000001");
        UUID higher = UUID.fromString("00000001-0000-1000-807f-000000000001");
        when(invites.listRequests(conversation, null, 2)).thenReturn(List.of(view(lower)));
        when(store.listCommunityJoinRequests(conversation, null, 2)).thenReturn(List.of(view(higher)));
        assertThat(service.list(actor, conversation, null, 1).nextCursor()).isEqualTo(higher);
    }

    @Test
    void rejectsNonTimeUuidBeforeQueryingCassandra() {
        assertThatThrownBy(() -> service.list(actor, conversation, UUID.randomUUID(), 10))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(invites, store);
    }

    private JoinRequestView view(UUID requestedAt) {
        return new JoinRequestView(conversation, requestedAt, UUID.randomUUID(), actor,
                null, "PENDING", null, null);
    }
}
