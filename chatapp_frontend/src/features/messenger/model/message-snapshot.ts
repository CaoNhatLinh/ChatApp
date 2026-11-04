import type { Message } from '../types/messenger.types';

export function mergeLiveMessage(current: Message | undefined, incoming: Message): Message {
  if (current && isOlderMessageSnapshot(current, incoming)) return current;
  const snapshot = current?.revision !== undefined && current.revision === incoming.revision ? current : incoming;
  const merged = { ...current, ...snapshot, sender: { ...current?.sender, ...incoming.sender },
    status: incoming.status ?? current?.status, pendingSend: incoming.pendingSend,
    pendingUploadIds: incoming.pendingUploadIds,
    retryNeedsAttachmentCheck: incoming.retryNeedsAttachmentCheck,
    retryAttachmentUnavailable: incoming.retryAttachmentUnavailable,
    attachments: snapshot.isDeleted ? [] : incoming.attachments ?? current?.attachments,
    replyTo: snapshot.isDeleted ? undefined : incoming.replyTo
      ? { ...current?.replyTo, ...incoming.replyTo } : current?.replyTo };
  if (!current) return { ...merged, replyTo: snapshot.isDeleted ? undefined : incoming.replyTo };
  return keepIndependentState(current, merged);
}

export function isOlderMessageSnapshot(current: Message | undefined, incoming: Message): boolean {
  return Boolean(current && (current.isDeleted && !incoming.isDeleted
    || current.revision !== undefined && incoming.revision !== undefined && incoming.revision < current.revision));
}

function keepIndependentState(current: Message, incoming: Message): Message {
  return { ...incoming, isPinned: current.isPinned ?? incoming.isPinned,
    reactions: current.reactions ?? incoming.reactions, poll: current.poll ?? incoming.poll,
    readReceipts: current.readReceipts ?? incoming.readReceipts,
    latestReadAt: newerReadAt(current.latestReadAt, incoming.latestReadAt) };
}
function newerReadAt(current?: string, incoming?: string): string | undefined {
  return !current || incoming && Date.parse(incoming) > Date.parse(current) ? incoming ?? current : current;
}
interface HistorySnapshots { current: readonly Message[]; incoming: readonly Message[]; before: readonly Message[] }

function reconcileHistory({ current, incoming, before }: HistorySnapshots): Map<string, Message> {
  const currentById = new Map(current.map(message => [message.messageId, message]));
  const beforeById = new Map(before.map(message => [message.messageId, message]));
  return new Map(incoming.map(message => {
    const existing = currentById.get(message.messageId);
    const merged = mergeLiveMessage(existing, message);
    const snapshot = !existing || existing !== beforeById.get(message.messageId) || isOlderMessageSnapshot(existing, message)
      ? merged : { ...merged, isPinned: message.isPinned ?? existing.isPinned, reactions: message.reactions ?? existing.reactions,
        poll: message.poll ?? existing.poll, readReceipts: message.readReceipts ?? existing.readReceipts };
    return [message.messageId, snapshot];
  }));
}

export function replaceHistoryWindow(context: HistorySnapshots): Message[] {
  const merged = reconcileHistory(context);
  const beforeById = new Map(context.before.map(message => [message.messageId, message]));
  const raced = context.current.filter(message => !merged.has(message.messageId) && message !== beforeById.get(message.messageId));
  return [...merged.values(), ...raced];
}

export function prependHistoryPage(context: HistorySnapshots): Message[] {
  const merged = reconcileHistory(context);
  return [...merged.values(), ...context.current.filter(message => !merged.has(message.messageId))];
}

export function appendHistoryPage(context: HistorySnapshots): Message[] {
  const merged = reconcileHistory(context);
  return [...context.current.map(message => merged.get(message.messageId) ?? message),
    ...context.incoming.filter(message => !context.current.some(existing => existing.messageId === message.messageId))];
}
