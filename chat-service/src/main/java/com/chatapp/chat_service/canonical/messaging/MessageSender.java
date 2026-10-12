package com.chatapp.chat_service.canonical.messaging;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalMessage;

import java.util.UUID;

public interface MessageSender {
    CanonicalMessage sendMessage(UUID actorId, UUID conversationId, CanonicalApiContracts.MessageSendRequest request);
}
