package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SystemSettingsRepository {
    UUID PRISTINE_REVISION = new UUID(0, 0);
    State find(String key);
    Command findCommand(String key, UUID commandId);
    boolean save(Command command, UUID expectedRevision);
    List<Command> pending(String key, UUID afterCommandId, int limit);
    void markAuditExported(String key, UUID commandId);

    record State(String key, String value, UUID revision, UUID updatedBy, Instant updatedAt) { }
    record Command(UUID commandId, UUID actorId, String fingerprint, State state, CanonicalRoomAuditEvent audit) { }
}
