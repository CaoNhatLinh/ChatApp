package com.chatapp.chat_service.canonical.user;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.UpdateProfileRequest;
import com.chatapp.chat_service.canonical.media.ManagedImageReference;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    @Mock UserRepository store;
    @Mock CanonicalEventRecorder eventRecorder;
    @Mock ManagedImageReference managedImages;

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

    @Test
    void avatarRetentionConflictPreventsProfileWriteAndAudit() {
        UUID actorId = UUID.randomUUID();
        String avatar = "https://res.cloudinary.com/noi/image/upload/chatapp/avatar.png";
        when(store.findById(actorId)).thenReturn(mock(CanonicalUser.class));
        doThrow(new ConflictException("image is being deleted")).when(managedImages).retain(avatar);

        assertThatThrownBy(() -> service().updateProfile(actorId, new UpdateProfileRequest("Alice", avatar)))
                .isInstanceOf(ConflictException.class);
        verify(store, never()).updateProfile(any(), any(), any(), any());
        verifyNoInteractions(eventRecorder);
    }

    private UserService service() {
        return new UserService(store, eventRecorder, managedImages);
    }
}
