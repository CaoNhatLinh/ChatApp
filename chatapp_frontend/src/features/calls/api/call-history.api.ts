import apiClient from '@/shared/api/apiClient';
import { CallCommandError, isCallRecord } from '../model/call-command-channel';

export type CallHistoryOutcome = 'RINGING' | 'ACCEPTED' | 'CANCELLED' | 'DECLINED' | 'MISSED' | 'UNANSWERED' | 'ENDED' | 'FAILED';
export interface CallHistoryParticipant {
  userId: string; role: 'CALLER' | 'CALLEE'; initiatedAt: string | null; acceptedAt: string | null;
}
export interface CallHistoryEntry {
  conversationId: string; callId: string; callerId: string; calleeId: string;
  callType: 'VOICE' | 'VIDEO'; direction: 'INCOMING' | 'OUTGOING'; outcome: CallHistoryOutcome;
  createdAt: string; acceptedAt: string | null; endedAt: string | null; version: number;
  participants: [CallHistoryParticipant, CallHistoryParticipant];
}
export interface CallHistoryQuery { actorId: string; month: string; conversationId?: string; cursor?: string }
export interface CallHistoryDetailQuery { actorId: string; conversationId: string; callId: string }
export interface CallHistoryPage { content: CallHistoryEntry[]; nextCursor: string | null; hasNext: boolean }

const pageLimit = 50;
const outcomes: readonly string[] = ['RINGING', 'ACCEPTED', 'CANCELLED', 'DECLINED', 'MISSED', 'UNANSWERED', 'ENDED', 'FAILED'];
const uuid = (value: unknown): value is string => typeof value === 'string'
  && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
  && value !== '00000000-0000-0000-0000-000000000000';

function invalidResponse(): never { throw new CallCommandError('INVALID_RESPONSE'); }

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/.test(value)
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19)) return invalidResponse();
  return value;
}

function nullableTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value); }

function parseParticipants(value: unknown, entry: Omit<CallHistoryEntry, 'participants'>): CallHistoryEntry['participants'] {
  if (!Array.isArray(value) || value.length !== 2) return invalidResponse();
  const caller: unknown = value[0];
  const callee: unknown = value[1];
  if (!isCallRecord(caller) || !isCallRecord(callee) || Array.isArray(caller) || Array.isArray(callee)
    || caller.userId !== entry.callerId || caller.role !== 'CALLER' || caller.initiatedAt !== entry.createdAt || caller.acceptedAt !== null
    || callee.userId !== entry.calleeId || callee.role !== 'CALLEE' || callee.initiatedAt !== null || callee.acceptedAt !== entry.acceptedAt) return invalidResponse();
  return [
    { userId: entry.callerId, role: 'CALLER', initiatedAt: entry.createdAt, acceptedAt: null },
    { userId: entry.calleeId, role: 'CALLEE', initiatedAt: null, acceptedAt: entry.acceptedAt },
  ];
}

function validateLifecycle(entry: Omit<CallHistoryEntry, 'participants'>): void {
  const { outcome, direction, createdAt, acceptedAt, endedAt } = entry;
  if ((outcome === 'RINGING' && (acceptedAt !== null || endedAt !== null))
    || (outcome === 'ACCEPTED' && (acceptedAt === null || endedAt !== null))
    || (!['RINGING', 'ACCEPTED'].includes(outcome) && endedAt === null)
    || (outcome === 'ENDED' && acceptedAt === null)
    || (['CANCELLED', 'DECLINED', 'MISSED', 'UNANSWERED'].includes(outcome) && acceptedAt !== null)
    || (outcome === 'MISSED' && direction !== 'INCOMING') || (outcome === 'UNANSWERED' && direction !== 'OUTGOING')
    || (acceptedAt !== null && Date.parse(acceptedAt) < Date.parse(createdAt))
    || (endedAt !== null && Date.parse(endedAt) < Date.parse(acceptedAt ?? createdAt))) invalidResponse();
}

function parseEntry(value: unknown, scope: { actorId: string; conversationId?: string; month?: string; callId?: string }): CallHistoryEntry {
  if (!isCallRecord(value) || Array.isArray(value) || !uuid(value.conversationId) || !uuid(value.callId)
    || !uuid(value.callerId) || !uuid(value.calleeId) || value.callerId === value.calleeId
    || (scope.conversationId !== undefined && value.conversationId !== scope.conversationId)
    || (scope.callId !== undefined && value.callId !== scope.callId)
    || (value.callType !== 'VOICE' && value.callType !== 'VIDEO')
    || typeof value.outcome !== 'string' || !outcomes.includes(value.outcome)
    || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1) return invalidResponse();
  const direction = value.callerId === scope.actorId ? 'OUTGOING' : value.calleeId === scope.actorId ? 'INCOMING' : null;
  if (direction === null || value.direction !== direction) return invalidResponse();
  const createdAt = timestamp(value.createdAt);
  if (scope.month !== undefined && createdAt.slice(0, 7) !== scope.month) return invalidResponse();
  const entry = { conversationId: value.conversationId, callId: value.callId, callerId: value.callerId, calleeId: value.calleeId,
    callType: value.callType, direction, outcome: value.outcome as CallHistoryOutcome, createdAt,
    acceptedAt: nullableTimestamp(value.acceptedAt), endedAt: nullableTimestamp(value.endedAt), version: value.version } satisfies Omit<CallHistoryEntry, 'participants'>;
  validateLifecycle(entry);
  return { ...entry, participants: parseParticipants(value.participants, entry) };
}

function parseCursor(value: unknown, hasNext: boolean): string | null {
  if (!hasNext) return value === null ? null : invalidResponse();
  if (typeof value !== 'string' || !value.trim() || value.length > 1024) return invalidResponse();
  return value;
}

function validateScope(scope: { actorId: string; conversationId?: string }): void {
  if (!uuid(scope.actorId) || (scope.conversationId !== undefined && !uuid(scope.conversationId))) throw new CallCommandError('INVALID');
}

function validateQuery(query: CallHistoryQuery): void {
  validateScope(query);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) || query.month < '1970-01'
    || (query.cursor !== undefined && (typeof query.cursor !== 'string' || !query.cursor.trim() || query.cursor.length > 1024))) {
    throw new CallCommandError('INVALID');
  }
}

/** Actor identity validates responses only; the server uses the authenticated session. */
export async function getCallHistory(input: CallHistoryQuery, signal: AbortSignal): Promise<CallHistoryPage> {
  const query = { ...input };
  validateQuery(query);
  const path = query.conversationId ? `/conversations/${query.conversationId}/calls/history` : '/calls/history';
  const response = await apiClient.get(path, { signal, headers: { 'Cache-Control': 'no-store' },
    params: { month: query.month, limit: pageLimit, ...(query.cursor !== undefined ? { cursor: query.cursor } : {}) } });
  const value = response.data;
  if (response.status !== 200 || !isCallRecord(value) || Array.isArray(value) || !Array.isArray(value.content)
    || value.content.length > pageLimit || typeof value.hasNext !== 'boolean') throw new CallCommandError('INVALID_RESPONSE');
  return { content: Array.from(value.content, entry => parseEntry(entry, query)),
    nextCursor: parseCursor(value.nextCursor, value.hasNext), hasNext: value.hasNext };
}

/** Detail revalidates exact room/call identity; readable history does not authorize a new call. */
export async function getCallHistoryDetail(input: CallHistoryDetailQuery, signal: AbortSignal): Promise<CallHistoryEntry> {
  const query = { ...input };
  validateScope(query);
  if (!uuid(query.conversationId) || !uuid(query.callId)) throw new CallCommandError('INVALID');
  const response = await apiClient.get(`/conversations/${query.conversationId}/calls/${query.callId}/history`,
    { signal, headers: { 'Cache-Control': 'no-store' } });
  if (response.status !== 200) return invalidResponse();
  return parseEntry(response.data, query);
}
