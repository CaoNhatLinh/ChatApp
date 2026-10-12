package com.chatapp.chat_service.canonical.appauth;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords;
import com.chatapp.chat_service.canonical.auth.RefreshTokenRepository;
import com.chatapp.chat_service.canonical.device.DeviceRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.canonical.service.CanonicalEventRecorder;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.UUID;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AppRoleAdminServiceTest {
    private final AppRoleRepository roles = mock(AppRoleRepository.class);
    private final AppAuthorizationService authorization = mock(AppAuthorizationService.class);
    private final UserRepository users = mock(UserRepository.class);
    private final RefreshTokenRepository sessions = mock(RefreshTokenRepository.class);
    private final DeviceRepository devices = mock(DeviceRepository.class);
    private final CanonicalEventRecorder events = mock(CanonicalEventRecorder.class);
    private final AppRoleAdminService service = new AppRoleAdminService(
            roles, authorization, users, sessions, devices, events);

    @Test
    void roleGrantRequiresAnAuditReason() {
        assertThatThrownBy(() -> service.grant(
                UUID.randomUUID(), UUID.randomUUID(), "SUPPORT", null, "  "))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("reason is required and must be at most 500 characters");
        verifyNoInteractions(roles, users, events);
    }

    @Test
    void accountStatusMutationRequiresAnAuditReason() {
        assertThatThrownBy(() -> service.updateAccountStatus(
                UUID.randomUUID(), UUID.randomUUID(), "BANNED", null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("reason is required and must be at most 500 characters");
        verifyNoInteractions(roles, users, events);
    }

    @Test
    void sessionRevokeRequiresAnAuditReasonBeforeTouchingAuthorization() {
        assertThatThrownBy(() -> service.revokeSession(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), "  "))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("reason is required and must be at most 500 characters");
        verifyNoInteractions(roles, users, events);
    }

    @Test
    void sessionInventoryRequiresUserReadAndNeverReturnsTokenHash() {
        UUID actorId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        when(users.findById(userId)).thenReturn(new CanonicalCqlStoreTestUserFactory().user(userId));
        var session = new RefreshTokenRepository.Session(
                UUID.randomUUID(), UUID.randomUUID(), null, Instant.now().plusSeconds(60), null, null);
        when(sessions.findSessions(userId, 10)).thenReturn(List.of(session));

        assertThat(service.listSessions(actorId, userId, 10)).containsExactly(session);
        verify(authorization).require(actorId, AppPermission.USER_READ);
        verify(sessions).findSessions(userId, 10);
    }

    private static final class CanonicalCqlStoreTestUserFactory {
        CqlCanonicalRecords.CanonicalUser user(UUID userId) {
            return new CqlCanonicalRecords.CanonicalUser(
                    userId, "target", "target", "target@example.com", "target@example.com", "hash",
                    "PASSWORD", null, "Target", null, "ACTIVE", Instant.now(), Instant.now(), null);
        }
    }
}
