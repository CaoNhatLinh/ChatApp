package com.chatapp.chat_service.canonical.search;

/** The projector's write boundary: never read/replace a search snapshot in Java. */
public interface MessageSearchWriter {
    void upsertSnapshot(MessageSearchDocument snapshot, boolean mentionsProvided, boolean pinEvent);
}
