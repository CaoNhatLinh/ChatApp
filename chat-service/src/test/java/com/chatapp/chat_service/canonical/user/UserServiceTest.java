package com.chatapp.chat_service.canonical.user;

import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock UserRepository store;
    @Mock CanonicalEventRecorder eventRecorder;

    @Test
    void searchReturnsBoundedPublicResultsAndCursor() {
        UUID actorId = UUID.randomUUID();
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        when(store.searchByPrefix("al", null, null, 2)).thenReturn(List.of(
                new UserRepository.UserDirectoryEntry("alice", firstId, "Alice", "Alice", null, "ACTIVE"),
                new UserRepository.UserDirectoryEntry("alina", secondId, "Alina", "Alina", null, "ACTIVE")));

        var page = service().searchUsers(actorId, " Al ", 1, null);

        assertThat(page.content()).singleElement()
                .extracting(user -> user.userId())
                .isEqualTo(firstId);
        assertThat(page.hasNext()).isTrue();
        assertThat(page.nextCursor()).isNotBlank();
    }

    @Test
    void searchRejectsQueriesThatCannotUseThePrefixProjection() {
        assertThatThrownBy(() -> service().searchUsers(UUID.randomUUID(), "a", 20, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("at least 2");
    }

    private UserService service() {
        return new UserService(store, eventRecorder);
    }
}
