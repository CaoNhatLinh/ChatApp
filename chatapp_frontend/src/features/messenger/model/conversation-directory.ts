import type { Conversation } from '../types/messenger.types';
import { compareMessageIds } from './message-order';

export function conversationTimestamp(value?: string): number {
    const parsed = Date.parse(value ?? '');
    return Number.isNaN(parsed) ? 0 : parsed;
}

function preserveKnownPreview(current: Conversation | undefined, incoming: Conversation): Conversation {
    if (!current?.lastMessage) return incoming;
    const previous = current.lastMessage;
    const next = incoming.lastMessage;
    const activityOrder = conversationTimestamp(incoming.lastActivityAt) - conversationTimestamp(current.lastActivityAt);
    const olderAtSameActivity = activityOrder === 0
        && (next ? compareMessageIds(next.messageId, previous.messageId) === -1 : previous.revision !== undefined);
    const knownContent = previous.revision !== undefined && previous.messageId === next?.messageId
        && (next.revision === undefined || next.revision < previous.revision);
    return activityOrder < 0 || olderAtSameActivity || knownContent
        ? { ...incoming, lastMessage: previous, lastActivityAt: current.lastActivityAt }
        : incoming;
}

export function reconcileConversationPage(
    previous: readonly Conversation[], incoming: readonly Conversation[], append: boolean
): Conversation[] {
    const known = new Map(previous.map(conversation => [conversation.conversationId, conversation]));
    const result = append ? known : new Map<string, Conversation>();
    for (const conversation of incoming) {
        const id = conversation.conversationId;
        result.set(id, preserveKnownPreview(result.get(id) ?? known.get(id), conversation));
    }
    return [...result.values()];
}
