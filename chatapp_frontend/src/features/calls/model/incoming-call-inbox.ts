import { isCallRecord, parseCallSnapshot, terminalCall, type CallSnapshot } from './call-command-channel';

export interface IncomingCallItem { snapshot: CallSnapshot; hidden: boolean }
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
  && value !== '00000000-0000-0000-0000-000000000000';

/** Only the participant-private STATE contract can enter this inbox; never SDP/ICE. */
function incomingSnapshot(raw: unknown, actor: string): CallSnapshot | null {
  if (!isCallRecord(raw) || raw.action !== 'STATE' || !uuid(raw.conversationId) || !uuid(raw.callId)
    || typeof raw.occurredAt !== 'string' || !Number.isFinite(Date.parse(raw.occurredAt))
    || !isCallRecord(raw.state) || raw.state.calleeId !== actor || !uuid(raw.state.callerId)
    || raw.state.callerId === actor || !uuid(raw.state.revision)) return null;
  try {
    return parseCallSnapshot(raw.state, { conversationId: raw.conversationId, callId: raw.callId,
      targetUserId: raw.state.callerId }, actor);
  } catch { return null; }
}

/** Bounded memory-only latest state, including tombstones against delayed/replayed ringing. */
export function receiveIncomingCall(items: IncomingCallItem[], raw: unknown, actor: string): IncomingCallItem[] {
  const snapshot = incomingSnapshot(raw, actor);
  if (!snapshot) return items;
  return mergeIncomingCall(items, snapshot);
}

/** Shared merge for validated HTTP snapshots and canonical private STATE. */
export function mergeIncomingCall(items: IncomingCallItem[], snapshot: CallSnapshot): IncomingCallItem[] {
  const index = items.findIndex(item => item.snapshot.conversationId === snapshot.conversationId && item.snapshot.callId === snapshot.callId);
  const previous = items[index];
  if (previous && (terminalCall(previous.snapshot) || previous.snapshot.version >= snapshot.version
    || previous.snapshot.callerId !== snapshot.callerId || previous.snapshot.calleeId !== snapshot.calleeId
    || previous.snapshot.callType !== snapshot.callType || previous.snapshot.createdAt !== snapshot.createdAt
    || previous.snapshot.status === 'ACCEPTED' && snapshot.status === 'RINGING')) return items;
  const item = { snapshot, hidden: previous?.hidden ?? false };
  if (index >= 0) return items.map((current, position) => position === index ? item : current);
  return [...items.slice(-127), item];
}

export function hideIncomingCall(items: IncomingCallItem[], conversationId: string, callId: string): IncomingCallItem[] {
  return items.map(item => item.snapshot.conversationId === conversationId && item.snapshot.callId === callId
    ? { ...item, hidden: true } : item);
}

export function nextIncomingCall(items: IncomingCallItem[], now: number, visibleRoom?: string): CallSnapshot | undefined {
  return items.find(({ snapshot, hidden }) => !hidden && snapshot.status === 'RINGING'
    && Date.parse(snapshot.deadline) > now && snapshot.conversationId !== visibleRoom)?.snapshot;
}
