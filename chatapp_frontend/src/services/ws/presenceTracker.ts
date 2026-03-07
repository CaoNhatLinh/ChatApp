// src/services/ws/presenceTracker.ts
// Singleton ref-counted presence tracker.
// Components call watch/unwatch; the tracker debounces and sends
// incremental addSubscriptions/removeSubscriptions to the backend.

import { presenceWsService } from './presenceWsService';
import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';

const FLUSH_DELAY_MS = 150;

class PresenceTracker {
  /** userId → reference count */
  private refCounts = new Map<string, number>();

  /** Users to subscribe on next flush */
  private pendingWatch = new Set<string>();

  /** Users to unsubscribe on next flush */
  private pendingUnwatch = new Set<string>();

  /** Debounce timer handle */
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  /**
   * Increment ref-count for each userId. If a user goes from 0→1,
   * it's added to pendingWatch. Triggers a debounced flush.
   */
  watch(userIds: string[]): void {
    if (!userIds.length) return;
    logger.debug('[PresenceTracker] watch called for', userIds);

    for (const id of userIds) {
      if (!id) continue;
      const prev = this.refCounts.get(id) ?? 0;
      this.refCounts.set(id, prev + 1);

      if (prev === 0) {
        // Newly watched
        this.pendingWatch.add(id);
        this.pendingUnwatch.delete(id); // cancel pending unwatch
      }
    }

    this.scheduleFlush();
  }

  /**
   * Decrement ref-count for each userId. If a user goes from 1→0,
   * it's added to pendingUnwatch. Triggers a debounced flush.
   */
  unwatch(userIds: string[]): void {
    if (!userIds.length) return;
    logger.debug('[PresenceTracker] unwatch called for', userIds);

    for (const id of userIds) {
      if (!id) continue;
      const prev = this.refCounts.get(id) ?? 0;
      if (prev <= 1) {
        this.refCounts.delete(id);
        this.pendingUnwatch.add(id);
        this.pendingWatch.delete(id); // cancel pending watch
      } else {
        this.refCounts.set(id, prev - 1);
      }
    }

    this.scheduleFlush();
  }

  /**
   * Re-sync all currently watched users with the backend.
   * Used after WS reconnect to restore server-side subscription state.
   */
  resync(): void {
    const allWatched = this.getWatchedUserIds();
    if (!allWatched.length) return;

    if (!wsConnectionManager.isConnected()) {
      logger.warn('[PresenceTracker] Cannot resync — WS not connected');
      return;
    }

    logger.debug('[PresenceTracker] Resync', allWatched.length, 'users');
    presenceWsService.subscribeToUserPresence(allWatched);
    presenceWsService.requestBatchPresence(allWatched);
  }

  /**
   * Clear all ref-counts and pending queues.
   * Call on logout / full teardown.
   *
   * @param sendUnsubscribe - If true (default for logout), send unsubscribe
   *   to the backend. If false (page unload), skip STOMP messages since they
   *   are unreliable during unload and the server cleans up on disconnect.
   */
  clear(sendUnsubscribe = true): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const allWatched = this.getWatchedUserIds();
    this.refCounts.clear();
    this.pendingWatch.clear();
    this.pendingUnwatch.clear();

    // Tell backend to unsubscribe everything (only on explicit logout)
    if (sendUnsubscribe && allWatched.length && wsConnectionManager.isConnected()) {
      presenceWsService.unsubscribeFromUserPresence(allWatched);
    }
  }

  /** Return all userIds with refCount > 0 */
  getWatchedUserIds(): string[] {
    return Array.from(this.refCounts.keys());
  }

  /** Return current ref count for a userId (for debugging) */
  getRefCount(userId: string): number {
    return this.refCounts.get(userId) ?? 0;
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private scheduleFlush(): void {
    if (this.flushTimer) return; // already scheduled
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  private flush(): void {
    if (!wsConnectionManager.isConnected()) {
      logger.debug('[PresenceTracker] Flush skipped — WS not connected, will retry');
      this.flushTimer = null;
      this.scheduleFlush();
      return;
    }

    const toWatch = Array.from(this.pendingWatch);
    const toUnwatch = Array.from(this.pendingUnwatch);
    this.pendingWatch.clear();
    this.pendingUnwatch.clear();

    if (toWatch.length) {
      logger.debug('[PresenceTracker] Subscribe', toWatch.length, 'users');
      presenceWsService.subscribeToUserPresence(toWatch);
      presenceWsService.requestBatchPresence(toWatch);
    }

    if (toUnwatch.length) {
      logger.debug('[PresenceTracker] Unsubscribe', toUnwatch.length, 'users');
      presenceWsService.unsubscribeFromUserPresence(toUnwatch);
    }
  }
}

/** Singleton instance */
export const presenceTracker = new PresenceTracker();
