package com.chatapp.chat_service.canonical.device;

import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {
    @Mock DeviceRepository store;

    @Test
    void registerNormalizesCanonicalMetadata() {
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        var expected = new DeviceRepository.DeviceSession(
                deviceId, "WEB", "WEB_PUSH", "Laptop", null, true, Instant.now(), Instant.now());
        when(store.save(
                org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.eq("WEB"), org.mockito.ArgumentMatchers.eq("WEB_PUSH"),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq("Laptop"),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Instant.class)))
                .thenReturn(expected);

        var actual = service().register(userId, new DeviceRegistrationRequest(
                deviceId, " web ", " web_push ", " ", " Laptop ", " "));

        assertThat(actual).isEqualTo(expected);
        verify(store).save(
                org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.eq("WEB"), org.mockito.ArgumentMatchers.eq("WEB_PUSH"),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.eq("Laptop"),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.any(Instant.class));
    }

    @Test
    void registerRejectsUnknownPlatform() {
        assertThatThrownBy(() -> service().register(UUID.randomUUID(),
                new DeviceRegistrationRequest(
                        UUID.randomUUID(), "DESKTOP", "WEB_PUSH", null, null, null)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("platform");
    }

    @Test
    void heartbeatRequiresAnActiveDevice() {
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        when(store.touch(
                org.mockito.ArgumentMatchers.eq(userId), org.mockito.ArgumentMatchers.eq(deviceId),
                org.mockito.ArgumentMatchers.any(Instant.class))).thenReturn(false);

        assertThatThrownBy(() -> service().heartbeat(userId, deviceId))
                .isInstanceOf(NotFoundException.class)
                .hasMessageContaining("active device");
    }

    private DeviceService service() {
        return new DeviceService(store);
    }
}
