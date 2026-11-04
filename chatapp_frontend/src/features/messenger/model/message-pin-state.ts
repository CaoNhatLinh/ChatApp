import type { Message, MessagePinState } from '../types/messenger.types';


export function applyPinState(messages: readonly Message[], state: MessagePinState | undefined): Message[] {
    if (!state) return [...messages];
    return messages.map(message => {
        const isPinned = !message.isDeleted && state.pins.some(pin =>
            pin.messageId === message.messageId && pin.messageBucket === message.messageBucket);
        return message.isPinned === isPinned ? message : { ...message, isPinned };
    });
}
