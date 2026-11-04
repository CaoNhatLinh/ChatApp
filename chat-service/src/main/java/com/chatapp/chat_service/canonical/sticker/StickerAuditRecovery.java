package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.audit.AuditRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

/** Traverses bounded catalog/command pages. Restart simply replays immutable audit IDs. */
@Service
public class StickerAuditRecovery {
    private static final Logger LOG = LoggerFactory.getLogger(StickerAuditRecovery.class);
    private final StickerRepository repository;
    private final AuditRepository audit;
    private UUID lastPack;
    public StickerAuditRecovery(StickerRepository repository, AuditRepository audit) {
        this.repository = repository;
        this.audit = audit;
    }

    public void export(StickerRepository.Command command) {
        // Audit upsert uses the original event ID/month; duplicate recovery is harmless.
        audit.saveAuditEvent(command.audit());
        repository.markAuditExported(command.pack().stickerPackId(), command.commandId());
    }

    @Scheduled(fixedDelayString = "${app.stickers.audit-recovery-delay-ms:5000}")
    public synchronized void recover() {
        try {
            var packs = repository.packIds(lastPack, 1);
            if (packs.isEmpty()) { lastPack = null; return; }
            UUID currentPack = packs.get(0);
            lastPack = currentPack;
            var entries = repository.pendingCommands(currentPack, 25);
            for (var entry : entries) {
                export(entry.command());
            }
        } catch (RuntimeException exception) {
            // Unacknowledged rows remain durable. Rotate so a failing pack cannot starve the others.
            LOG.warn("Sticker audit recovery will retry: {}", exception.getClass().getSimpleName());
        }
    }
}
