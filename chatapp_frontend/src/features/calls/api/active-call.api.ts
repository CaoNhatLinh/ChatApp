import apiClient from '@/shared/api/apiClient';
import { CallCommandError, isCallRecord, parseCallSnapshot, terminalCall, type CallSnapshot } from '../model/call-command-channel';

export interface ActiveCallScope { conversationId: string; actorId: string; peerUserId: string }
const callIdPattern = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

/** Only 204 means absence. Auth, storage and malformed responses remain errors. */
export async function getActiveCall(scope: ActiveCallScope, signal: AbortSignal): Promise<CallSnapshot | null> {
  const response = await apiClient.get(`/conversations/${scope.conversationId}/calls/active`, { signal });
  if (response.status === 204) return null;
  const value = response.data;
  if (response.status !== 200 || !isCallRecord(value) || typeof value.callId !== 'string'
    || !callIdPattern.test(value.callId) || value.callId === '00000000-0000-0000-0000-000000000000') {
    throw new CallCommandError('INVALID_RESPONSE');
  }
  const snapshot = parseCallSnapshot(value, { conversationId: scope.conversationId, callId: value.callId, targetUserId: scope.peerUserId }, scope.actorId);
  if (terminalCall(snapshot)) throw new CallCommandError('INVALID_RESPONSE');
  return snapshot;
}
