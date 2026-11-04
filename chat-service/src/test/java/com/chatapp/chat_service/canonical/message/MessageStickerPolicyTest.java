package com.chatapp.chat_service.canonical.message;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.chatapp.chat_service.canonical.sticker.StickerCatalogService;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MessageStickerPolicyTest {
    final StickerCatalogService catalog = mock(StickerCatalogService.class);
    final MessageStickerPolicy policy = new MessageStickerPolicy(catalog);
    MessageSendRequest request(String type, UUID stickerId, String content, String format, UUID pollId) {
        return new MessageSendRequest(UUID.randomUUID(), type, content, format, null, null,
                stickerId, pollId, null, null, null, List.of(), Set.of(), false, null);
    }
    @Test void stickerPayloadIsIdOnlyNotClientSuppliedArtworkOrCaption() {
        policy.validateShape("STICKER", request("STICKER", UUID.randomUUID(), "", "PLAIN", null));
        assertThatThrownBy(() -> policy.validateShape("STICKER", request("STICKER", null, "", "PLAIN", null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> policy.validateShape("STICKER", request("STICKER", UUID.randomUUID(), "https://fake/art.png", "PLAIN", null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> policy.validateShape("STICKER", request("STICKER", UUID.randomUUID(), "", "HTML", null))).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> policy.validateShape("STICKER", request("STICKER", UUID.randomUUID(), "", "PLAIN", UUID.randomUUID()))).isInstanceOf(BadRequestException.class);
        verifyNoInteractions(catalog);
    }
    @Test void otherMessageTypesCannotSmuggleStickerIdentity() {
        policy.validateShape("TEXT", request("TEXT", null, "hello", "PLAIN", null));
        assertThatThrownBy(() -> policy.validateShape("TEXT", request("TEXT", UUID.randomUUID(), "hello", "PLAIN", null))).isInstanceOf(BadRequestException.class);
    }
    @Test void catalogChecksApplyToNewStickerMessagesOnly() {
        UUID stickerId = UUID.randomUUID();
        policy.validateAvailable("STICKER", request("STICKER", stickerId, "", "PLAIN", null));
        verify(catalog).requireSendable(stickerId);
        policy.validateAvailable("TEXT", request("TEXT", null, "hello", "PLAIN", null));
        verifyNoMoreInteractions(catalog);
    }
}
