package com.chatapp.chat_service.presence.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class PresenceFlowMetrics {

    private final MeterRegistry meterRegistry;

    public void recordStatusChange(String outcome) {
        meterRegistry.counter("presence_status_change_total", "outcome", sanitize(outcome)).increment();
    }

    public void recordStatusSyncEvent(String eventType) {
        meterRegistry.counter("presence_status_sync_event_total", "event_type", sanitize(eventType)).increment();
    }

    public void recordHeartbeat(String source) {
        meterRegistry.counter("presence_heartbeat_total", "source", sanitize(source)).increment();
    }

    public void recordPresenceConnection(String action, String outcome) {
        meterRegistry.counter("presence_connection_total", "action", sanitize(action), "outcome", sanitize(outcome)).increment();
    }

    public void recordPresenceSubscription(String direction, int requestedCount, String outcome) {
        meterRegistry.counter(
            "presence_subscription_total",
            "direction",
            sanitize(direction),
            "outcome",
            sanitize(outcome),
            "size_bucket",
            batchSizeBucket(requestedCount)
        ).increment();
    }

    public void recordBatchPresence(String outcome, int requestedCount, long durationNanos) {
        String bucket = batchSizeBucket(requestedCount);
        meterRegistry.counter(
            "presence_batch_request_total",
            "outcome",
            sanitize(outcome),
            "size_bucket",
            bucket
        ).increment();
        meterRegistry.timer(
            "presence_batch_duration_ms",
            "outcome",
            sanitize(outcome),
            "size_bucket",
            bucket
        ).record(Duration.ofNanos(durationNanos));
    }

    public void recordBroadcast(String status, int watchers) {
        meterRegistry.counter(
            "presence_broadcast_total",
            "status",
            sanitize(status),
            "watchers_bucket",
            batchSizeBucket(Math.max(0, watchers))
        ).increment();
    }

    private String batchSizeBucket(int requestedCount) {
        if (requestedCount <= 0) {
            return "0";
        }
        if (requestedCount <= 20) {
            return "1-20";
        }
        if (requestedCount <= 50) {
            return "21-50";
        }
        if (requestedCount <= 100) {
            return "51-100";
        }
        return "100+";
    }

    private String sanitize(String value) {
        return (value == null || value.isBlank()) ? "unknown" : value;
    }
}

