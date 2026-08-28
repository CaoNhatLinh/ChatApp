package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts.MessageSendRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Stable fingerprint used to prevent a client idempotency key being reused for another payload. */
final class MessageRequestFingerprint {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

    private MessageRequestFingerprint() {
    }

    static String sha256(MessageSendRequest request) {
        try {
            byte[] canonicalPayload = MAPPER.writeValueAsBytes(request);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonicalPayload));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to fingerprint message request", exception);
        }
    }
}
