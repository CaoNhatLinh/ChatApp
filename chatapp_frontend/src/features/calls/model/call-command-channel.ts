export type CallAction = 'START' | 'JOIN' | 'LEAVE' | 'END' | 'FAIL' | 'HEARTBEAT' | 'SYNC' | 'SIGNAL';
export type CallStatus = 'RINGING' | 'ACCEPTED' | 'CANCELLED' | 'DECLINED' | 'MISSED' | 'ENDED' | 'FAILED';
export interface CallSnapshot {
  conversationId: string; callId: string; callerId: string; calleeId: string;
  callType: 'VOICE' | 'VIDEO'; status: CallStatus; version: number; revision: string;
  createdAt: string; acceptedAt: string | null; endedAt: string | null; deadline: string;
}
export interface CallCommandBody {
  conversationId: string; callId: string; targetUserId: string;
  callType?: 'VOICE' | 'VIDEO'; signal?: Record<string, unknown>;
}
interface CallPort {
  isConnected(): boolean;
  subscribe(destination: string, callback: (value: unknown) => void): () => void;
  publish(destination: string, body: unknown): void;
}
type ErrorCode = 'INVALID' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE' | 'UNCONFIRMED' | 'CLOSED' | 'DISCONNECTED' | 'INVALID_RESPONSE' | 'BUSY';
export class CallCommandError extends Error {
  readonly uncertain: boolean;
  constructor(readonly code: ErrorCode) {
    super(`Call command: ${code}`);
    this.uncertain = ['UNAVAILABLE', 'UNCONFIRMED', 'CLOSED', 'INVALID_RESPONSE'].includes(code);
  }
}
export const isCallRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const statuses: readonly string[] = ['RINGING', 'ACCEPTED', 'CANCELLED', 'DECLINED', 'MISSED', 'ENDED', 'FAILED'];
export const terminalCall = (state: CallSnapshot): boolean => state.status !== 'RINGING' && state.status !== 'ACCEPTED';

/** Validate server authority before it can affect a local media session. */
export function parseCallSnapshot(value: unknown, scope: CallCommandBody, actor: string): CallSnapshot {
  if (!isCallRecord(value) || value.conversationId !== scope.conversationId || value.callId !== scope.callId
    || !uuid(value.callerId) || !uuid(value.calleeId) || !uuid(value.revision)
    || !((value.callerId === actor && value.calleeId === scope.targetUserId) || (value.calleeId === actor && value.callerId === scope.targetUserId))
    || (value.callType !== 'VOICE' && value.callType !== 'VIDEO') || (scope.callType && value.callType !== scope.callType)
    || typeof value.status !== 'string' || !statuses.includes(value.status)
    || typeof value.version !== 'number' || !Number.isSafeInteger(value.version) || value.version < 1
    || !date(value.createdAt) || !date(value.deadline)
    || (value.acceptedAt !== null && !date(value.acceptedAt)) || (value.endedAt !== null && !date(value.endedAt))) {
    throw new CallCommandError('INVALID_RESPONSE');
  }
  const status = value.status as CallStatus;
  if ((status === 'RINGING' && (value.acceptedAt !== null || value.endedAt !== null))
    || (status === 'ACCEPTED' && (value.acceptedAt === null || value.endedAt !== null))
    || (!['RINGING', 'ACCEPTED'].includes(status) && value.endedAt === null)) throw new CallCommandError('INVALID_RESPONSE');
  return { conversationId: scope.conversationId, callId: scope.callId, callerId: value.callerId, calleeId: value.calleeId,
    callType: value.callType, status, version: value.version, revision: value.revision, createdAt: value.createdAt,
    acceptedAt: value.acceptedAt, endedAt: value.endedAt, deadline: value.deadline };
}

interface Pending {
  action: CallAction; body: CallCommandBody; timer: ReturnType<typeof setTimeout>;
  resolve: (state: CallSnapshot) => void; reject: (error: CallCommandError) => void;
}

/** In-memory correlation only. No automatic replay, storage, or new call ID. */
export class CallCommandChannel {
  private readonly pending = new Map<string, Pending>();
  private readonly unsubscribe: () => void;
  private closed = false;
  constructor(private readonly port: CallPort, private readonly actor: string, private readonly timeoutMs = 10000) {
    this.unsubscribe = port.subscribe('/user/queue/call-results', value => this.receive(value));
  }
  send(action: CallAction, body: CallCommandBody): Promise<CallSnapshot> {
    if (this.closed) return Promise.reject(new CallCommandError('CLOSED'));
    if (!this.port.isConnected()) return Promise.reject(new CallCommandError('DISCONNECTED'));
    if (this.pending.size >= 64) return Promise.reject(new CallCommandError('BUSY'));
    const requestId = crypto.randomUUID();
    const snapshot = Object.freeze({ ...body });
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.reject(requestId, new CallCommandError('UNCONFIRMED')), this.timeoutMs);
      this.pending.set(requestId, { action, body: snapshot, timer, resolve, reject });
      try { this.port.publish(`/app/call.${action.toLowerCase()}`, { ...snapshot, requestId }); }
      catch { this.reject(requestId, new CallCommandError('UNCONFIRMED')); }
    });
  }
  close(): void {
    if (this.closed) return;
    this.closed = true; this.unsubscribe();
    for (const id of this.pending.keys()) this.reject(id, new CallCommandError('CLOSED'));
  }
  private receive(raw: unknown): void {
    if (!isCallRecord(raw) || typeof raw.requestId !== 'string') return;
    const pending = this.pending.get(raw.requestId);
    if (!pending) return;
    try {
      if (raw.conversationId !== pending.body.conversationId || raw.callId !== pending.body.callId || raw.action !== pending.action) throw new CallCommandError('INVALID_RESPONSE');
      if (raw.accepted !== true || raw.errorCode !== null) {
        const errors = ['INVALID', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'UNAVAILABLE'];
        throw new CallCommandError(raw.accepted === false && raw.state === null && typeof raw.errorCode === 'string' && errors.includes(raw.errorCode) ? raw.errorCode as ErrorCode : 'INVALID_RESPONSE');
      }
      const state = parseCallSnapshot(raw.state, pending.body, this.actor);
      clearTimeout(pending.timer); this.pending.delete(raw.requestId); pending.resolve(state);
    } catch (error) { this.reject(raw.requestId, error instanceof CallCommandError ? error : new CallCommandError('INVALID_RESPONSE')); }
  }
  private reject(id: string, error: CallCommandError): void {
    const pending = this.pending.get(id);
    if (!pending) return;
    clearTimeout(pending.timer); this.pending.delete(id); pending.reject(error);
  }
}
