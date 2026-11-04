import axios from 'axios';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { getConversationById } from '../api/messenger.api';
import { useMessengerStore } from './messenger.store';
import type { ConversationEntry } from './messenger.store.types';

/** Load an unknown selected room without letting late requests replace a new selection/session. */
export async function loadConversationEntry(conversationId: string): Promise<boolean> {
    const store = useMessengerStore.getState();
    if (store.activeConversationId !== conversationId) return false;
    if (store.conversations.some(room => room.conversationId === conversationId)) return true;
    const requestId = crypto.randomUUID();
    const generation = getSessionGeneration();
    const isCurrent = () => {
        const current = useMessengerStore.getState();
        return generation === getSessionGeneration() && current.activeConversationId === conversationId
            && current.conversationEntry?.requestId === requestId;
    };
    store.setConversationEntry({ conversationId, requestId, status: 'loading' });
    try {
        const conversation = await getConversationById(conversationId);
        if (!isCurrent()) return false;
        useMessengerStore.getState().hoistConversation(conversation);
        useMessengerStore.getState().setConversationEntry(null);
        return true;
    } catch (error) {
        if (isCurrent()) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
            const reason: Extract<ConversationEntry, { status: 'error' }>['reason'] =
                status === 403 ? 'forbidden' : status === 404 ? 'missing' : status === 400 ? 'invalid' : 'unavailable';
            useMessengerStore.getState().setConversationEntry({ conversationId, requestId, status: 'error', reason });
        }
        return false;
    }
}
