package com.chatapp.chat_service.canonical.call;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Bounded cyclic recovery. Durable authority, not checkpoint ownership, fences writers. */
@Component
public class CallTimeoutWorker {
    private static final Logger log = LoggerFactory.getLogger(CallTimeoutWorker.class);
    private final CallWorkRepository work;
    private final CallRepository calls;
    private final CallLifecycleService lifecycle;
    private final CallStatePublisher publisher;
    private final Clock clock;
    private final int batch;
    @Autowired
    public CallTimeoutWorker(CallWorkRepository work, CallRepository calls, CallLifecycleService lifecycle,
                             CallStatePublisher publisher, @Value("${app.calls.work-batch-size:25}") int batch) {
        this(work, calls, lifecycle, publisher, batch, Clock.systemUTC());
    }
    CallTimeoutWorker(CallWorkRepository work, CallRepository calls, CallLifecycleService lifecycle,
                      CallStatePublisher publisher, int batch, Clock clock) {
        this.work = work; this.calls = calls; this.lifecycle = lifecycle; this.publisher = publisher;
        this.batch = Math.max(1, Math.min(100, batch)); this.clock = clock;
    }
    @Scheduled(fixedDelayString = "${app.calls.work-poll-delay-ms:1000}")
    public void run() {
        for (int shard = 0; shard < CallWorkRepository.SHARDS; shard++) {
            try { scan(shard); }
            catch (RuntimeException failure) { failed(shard, failure); }
        }
    }
    void scan(int shard) {
        var progress = work.progress(shard);
        var rows = work.page(shard, progress.after(), clock.instant(), batch);
        for (var row : rows) {
            try { if (process(row)) work.remove(row.key()); }
            catch (RuntimeException failure) { failed(shard, failure); }
        }
        // Retained failures return on wrap instead of starving every later row.
        if (!rows.isEmpty()) work.advance(shard, progress, rows.get(rows.size() - 1).key());
        else if (progress.after() != null) work.advance(shard, progress, null);
    }
    boolean process(CallWorkRepository.Work row) {
        Instant now = clock.instant();
        if (now.isBefore(row.key().dueAt())) return false;
        var key = row.key();
        CallState current = calls.find(key.conversationId(), key.callId());
        if (current == null || !current.revision().equals(key.revision())) {
            var slot = calls.slot(key.conversationId());
            if (slot == null) return false;
            // Snapshot and slot are separate reads: this candidate may have won
            // between them. Retry rather than discarding its only repair work.
            if (slot.revision().equals(key.revision())) return false;
            if (!slot.revision().equals(row.expectedSlotRevision())) return true;
            if (now.isBefore(row.writeDeadline())) return false;
            return calls.fenceSlot(key.conversationId(), slot, UUID.randomUUID());
        }
        var expiry = new CallRepository.Expiry(row.deadline(), key.conversationId(), key.callId(), key.revision(), row.expectedSlotRevision());
        if (key.kind() == CallWorkRepository.Kind.EXPIRE) return lifecycle.expire(expiry);
        if (!current.terminal() && !now.isBefore(current.deadline())) {
            lifecycle.expire(expiry);
            return false; // Terminal prewrite is independent; recheck this pointer next cycle.
        }
        return publisher.publish(current);
    }
    private void failed(int shard, RuntimeException failure) {
        // Never log private state, payload, participant IDs or exception messages.
        log.warn("Call recovery retained work in shard {} ({})", shard, failure.getClass().getSimpleName());
    }
}
