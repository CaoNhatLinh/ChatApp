package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.message.MessageService;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.junit.jupiter.api.Test;
import java.time.Instant;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class StickerMessageServiceTest {
    final MessageService messages = mock(MessageService.class);
    final StickerCatalogService catalog = mock(StickerCatalogService.class);
    final StickerMessageService service = new StickerMessageService(messages, catalog);
    final UUID actor = UUID.randomUUID(), room = UUID.randomUUID(), messageId = UUID.randomUUID(), stickerId = UUID.randomUUID();
    final String bucket = "2026-10-12-01:00";
    CanonicalMessage message(String type, boolean deleted) {
        return new CanonicalMessage(room, bucket, messageId, actor, type, "", "PLAIN", null, null, stickerId,
                null, null, null, null, null, deleted, null, null, null, false, false, false, Instant.now(), UUID.randomUUID(), null, null, 0);
    }
    @Test void artworkUsesStickerIdFromAuthorizedMessageNotUserInput() {
        when(messages.getMessage(actor, room, bucket, messageId)).thenReturn(message("STICKER", false));
        var view = new StickerCatalogService.StickerArtworkView(stickerId, "Wave", null);
        when(catalog.historicalArtwork(stickerId)).thenReturn(view);
        assertThat(service.artwork(actor, room, bucket, messageId)).isSameAs(view);
        verify(messages).getMessage(actor, room, bucket, messageId);
        verify(catalog).historicalArtwork(stickerId);
    }
    @Test void outsiderCannotLearnArtworkIdentityOrMetadata() {
        when(messages.getMessage(actor, room, bucket, messageId)).thenThrow(new ForbiddenException("not member"));
        assertThatThrownBy(() -> service.artwork(actor, room, bucket, messageId)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(catalog);
    }
    @Test void deletedAndOtherMessageTypesDoNotRevealRetainedArtwork() {
        when(messages.getMessage(actor, room, bucket, messageId)).thenReturn(message("STICKER", true), message("TEXT", false));
        assertThatThrownBy(() -> service.artwork(actor, room, bucket, messageId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.artwork(actor, room, bucket, messageId)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(catalog);
    }
}
