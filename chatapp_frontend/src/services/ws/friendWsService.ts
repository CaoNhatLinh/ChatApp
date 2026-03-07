// src/services/ws/friendWsService.ts
import { wsConnectionManager } from './wsConnectionManager';
import { logger } from '@/utils/logger';

export interface FriendRequestUpdate {
    friendId: string;
    status: 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'UNFRIENDED';
}

class FriendWsService {
    subscribeToFriendRequests(callback: (event: FriendRequestUpdate) => void): void {
        if (!wsConnectionManager.stompClient?.connected) {
            logger.warn('[FriendWsService] Cannot subscribe - not connected');
            return;
        }

        if (wsConnectionManager.hasSubscription('friend-requests')) {
            return;
        }

        const subscription = wsConnectionManager.stompClient.subscribe('/user/queue/friend-requests', (frame) => {
            try {
                const data = JSON.parse(frame.body) as FriendRequestUpdate;
                callback(data);
            } catch (error) {
                logger.error('[FriendWsService] Error parsing friend request update:', error);
            }
        });

        wsConnectionManager.setSubscription('friend-requests', subscription);
        logger.debug('[FriendWsService] Friend requests subscription created');
    }

    unsubscribe(): void {
        wsConnectionManager.removeSubscription('friend-requests');
    }
}

export const friendWsService = new FriendWsService();
