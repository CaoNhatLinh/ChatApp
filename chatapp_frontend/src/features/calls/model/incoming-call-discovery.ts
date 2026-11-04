import { getIncomingCalls } from '../api/incoming-calls.api';
import { CallCommandError, type CallSnapshot } from './call-command-channel';

export type IncomingDiscoveryStatus = 'loading' | 'ready' | 'error' | 'more';
interface Observer {
  receive: (snapshot: CallSnapshot) => void;
  status: (status: IncomingDiscoveryStatus) => void;
  current: () => boolean;
}
const pagesPerBatch = 8;
const maximumCursors = 128;

/** Owns one abortable traversal; transport/subscription readiness belongs to the hook. */
export class IncomingCallDiscovery {
  private request: AbortController | null = null;
  private cursor: string | undefined;
  private cursors = new Set<string>();
  private disposed = false;

  constructor(private actorId: string, private observer: Observer) {}

  refresh() {
    if (!this.current()) return;
    this.request?.abort();
    this.cursor = undefined;
    this.cursors.clear();
    this.start();
  }
  loadMore() {
    if (this.current() && !this.request && this.cursor) this.start();
  }
  dispose() { this.disposed = true; this.request?.abort(); }

  private current() { return !this.disposed && this.observer.current(); }
  private owns(request: AbortController) {
    return this.current() && this.request === request && !request.signal.aborted;
  }
  private start() {
    const request = new AbortController();
    this.request = request;
    this.observer.status('loading');
    void this.scan(request).catch(() => {
      if (this.owns(request)) this.observer.status('error');
    }).finally(() => { if (this.request === request) this.request = null; });
  }
  private async scan(request: AbortController) {
    for (let page = 0; page < pagesPerBatch; page++) {
      if (!this.owns(request)) return;
      const result = await getIncomingCalls({ actorId: this.actorId, cursor: this.cursor }, request.signal);
      if (!this.owns(request)) return;
      for (const snapshot of result.content) this.observer.receive(snapshot);
      if (!result.hasNext) { this.cursor = undefined; this.observer.status('ready'); return; }
      this.advance(result.nextCursor);
    }
    if (this.owns(request)) this.observer.status('more');
  }
  private advance(cursor: string | null) {
    if (!cursor || this.cursors.has(cursor) || this.cursors.size >= maximumCursors) throw new CallCommandError('INVALID_RESPONSE');
    this.cursors.add(cursor);
    this.cursor = cursor;
  }
}
