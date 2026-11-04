import apiClient from '@/shared/api/apiClient';
import { CallCommandError, isCallRecord, parseCallSnapshot, type CallSnapshot } from '../model/call-command-channel';

export interface IncomingCallQuery { actorId: string; cursor?: string }
export interface IncomingCallPage { content: CallSnapshot[]; nextCursor: string | null; hasNext: boolean }

const incomingPageLimit = 50;
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
  && value !== '00000000-0000-0000-0000-000000000000';

function parseIncomingSnapshot(value: unknown, actorId: string): CallSnapshot {
  if (!isCallRecord(value) || Array.isArray(value) || !uuid(value.conversationId) || !uuid(value.callId)
    || !uuid(value.callerId) || !uuid(value.calleeId) || !uuid(value.revision)
    || value.calleeId !== actorId || value.callerId === actorId || value.status !== 'RINGING') {
    throw new CallCommandError('INVALID_RESPONSE');
  }
  return parseCallSnapshot(value, { conversationId: value.conversationId, callId: value.callId,
    targetUserId: value.callerId }, actorId);
}

function parseNextCursor(value: unknown, hasNext: boolean): string | null {
  if (!hasNext) {
    if (value !== null) throw new CallCommandError('INVALID_RESPONSE');
    return null;
  }
  if (typeof value !== 'string' || !value.trim() || value.length > 1024) throw new CallCommandError('INVALID_RESPONSE');
  return value;
}

/** The actor scopes validation only; authenticated server identity scopes discovery. */
export async function getIncomingCalls(query: IncomingCallQuery, signal: AbortSignal): Promise<IncomingCallPage> {
  const response = await apiClient.get('/calls/incoming', { signal, headers: { 'Cache-Control': 'no-store' },
    params: { limit: incomingPageLimit, ...(query.cursor !== undefined ? { cursor: query.cursor } : {}) } });
  const value = response.data;
  if (response.status !== 200 || !isCallRecord(value) || Array.isArray(value) || !Array.isArray(value.content)
    || value.content.length > incomingPageLimit || typeof value.hasNext !== 'boolean') {
    throw new CallCommandError('INVALID_RESPONSE');
  }
  const nextCursor = parseNextCursor(value.nextCursor, value.hasNext);
  return { content: Array.from(value.content, state => parseIncomingSnapshot(state, query.actorId)), nextCursor, hasNext: value.hasNext };
}
