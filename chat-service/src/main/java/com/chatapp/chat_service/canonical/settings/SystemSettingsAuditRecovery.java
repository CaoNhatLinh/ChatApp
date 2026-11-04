package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.audit.AuditRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.UUID;

@Service
public class SystemSettingsAuditRecovery {
    private static final Logger LOG = LoggerFactory.getLogger(SystemSettingsAuditRecovery.class);
    private final SystemSettingsRepository repository;
    private final AuditRepository audit;
    private final UUID[] cursors = new UUID[SystemSetting.values().length];
    private int nextKey;
    public SystemSettingsAuditRecovery(SystemSettingsRepository repository, AuditRepository audit) {
        this.repository = repository; this.audit = audit;
    }
    public void export(SystemSettingsRepository.Command command) {
        audit.saveAuditEvent(command.audit());
        repository.markAuditExported(command.state().key(), command.commandId());
    }
    @Scheduled(fixedDelayString = "${app.settings.audit-recovery-delay-ms:5000}")
    public synchronized void recover() {
        int current = nextKey;
        nextKey = (nextKey + 1) % cursors.length;
        String key = SystemSetting.values()[current].key();
        try {
            var page = repository.pending(key, cursors[current], 25);
            cursors[current] = page.isEmpty() ? null : page.get(page.size() - 1).commandId();
            for (var command : page) {
                try { export(command); }
                catch (RuntimeException failure) {
                    LOG.warn("System setting audit export retained pending work ({})", failure.getClass().getSimpleName());
                }
            }
        } catch (RuntimeException failure) {
            LOG.warn("System setting audit recovery will retry ({})", failure.getClass().getSimpleName());
        }
    }
}
