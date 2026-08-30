import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { createPresenceTrackingController } from '@/features/presence/services/presenceTrackingState';

export const presenceTracker = createPresenceTrackingController({
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
});
