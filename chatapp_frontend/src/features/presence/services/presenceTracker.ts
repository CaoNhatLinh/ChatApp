import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { createPresenceTrackingController } from '@/features/presence/services/presenceTrackingState';
import { createPresenceCommandBatcher } from '@/features/presence/services/presenceCommandBatcher';

const batchedPresenceTransport = createPresenceCommandBatcher({
  transport: {
    subscribe(userIds, conversationId) {
      presenceWsService.subscribeToUserPresence(userIds, conversationId);
    },
    unsubscribe(userIds, conversationId) {
      presenceWsService.unsubscribeFromUserPresence(userIds, conversationId);
    },
    sendBatch(userIds, conversationId) {
      presenceWsService.sendPresenceBatch(userIds, conversationId);
    },
    clearPresence(userId) {
      usePresenceStore.getState().removePresence(userId);
    },
  },
});

export const presenceTracker = createPresenceTrackingController(batchedPresenceTransport);
