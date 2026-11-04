import type { CallHistoryEntry, CallHistoryPage, CallHistoryQuery, CallHistoryDetailQuery } from '../api/call-history.api';

export interface CallHistoryReading {
  items: CallHistoryEntry[]; detail: CallHistoryEntry | null;
  selected: { conversationId: string; callId: string } | null;
  loading: boolean; error: 'forbidden' | 'missing' | 'unavailable' | null;
  hasNext: boolean; limited: boolean;
}
interface HistoryPort {
  current: () => boolean; changed: (state: CallHistoryReading) => void;
  list: (query: CallHistoryQuery, signal: AbortSignal) => Promise<CallHistoryPage>;
  detail: (query: CallHistoryDetailQuery, signal: AbortSignal) => Promise<CallHistoryEntry>;
}
export const emptyHistoryReading = (): CallHistoryReading => ({ items: [], detail: null, selected: null,
  loading: true, error: null, hasNext: false, limited: false });

export class CallHistoryReader {
  private state = emptyHistoryReading();
  private request: AbortController | null = null;
  private disposed = false;
  private cursor: string | null = null;
  private seen = new Set<string>();
  private listBeforeDetail: CallHistoryReading | null = null;
  private readonly scope: CallHistoryQuery;

  constructor(scope: CallHistoryQuery, private readonly port: HistoryPort) { this.scope = { ...scope }; }

  async refresh(): Promise<void> {
    this.listBeforeDetail = null;
    this.cursor = null;
    this.seen.clear();
    this.state = emptyHistoryReading();
    const request = this.begin();
    if (!request) return;
    try { this.applyPage(await this.port.list(this.scope, request.signal), request); }
    catch (error) { this.failed(error, request); }
  }

  async loadMore(): Promise<void> {
    if (this.state.loading || !this.state.hasNext || this.state.selected || !this.cursor) return;
    const request = this.begin();
    if (!request) return;
    try { this.applyPage(await this.port.list({ ...this.scope, cursor: this.cursor }, request.signal), request); }
    catch (error) { this.failed(error, request, true); }
  }

  async openDetail(key: { conversationId: string; callId: string }): Promise<void> {
    const selected = { conversationId: key.conversationId, callId: key.callId };
    if (!this.state.selected) this.listBeforeDetail = { ...this.state, loading: false };
    this.state = { ...emptyHistoryReading(), selected };
    const request = this.begin();
    if (!request) return;
    try {
      const detail = await this.port.detail({ ...selected, actorId: this.scope.actorId }, request.signal);
      if (!this.owns(request)) return;
      this.state = { ...this.state, detail, loading: false };
      this.port.changed(this.state);
    } catch (error) { this.failed(error, request); }
  }

  reloadCurrent(): Promise<void> {
    if (this.state.selected) return this.openDetail(this.state.selected);
    if (this.state.error && this.state.hasNext) return this.loadMore();
    return this.refresh();
  }

  back(): void {
    if (this.disposed || !this.port.current() || !this.state.selected) return;
    const list = this.listBeforeDetail;
    if (!list) {
      void this.refresh();
      return;
    }
    this.request?.abort();
    this.listBeforeDetail = null;
    this.state = list;
    this.port.changed(this.state);
  }

  dispose(): void { this.disposed = true; this.request?.abort(); }

  private begin(): AbortController | null {
    if (this.disposed || !this.port.current()) return null;
    this.request?.abort();
    const request = new AbortController();
    this.request = request;
    this.state = { ...this.state, loading: true, error: null };
    this.port.changed(this.state);
    return request;
  }

  private owns(request: AbortController): boolean {
    return !this.disposed && !request.signal.aborted && this.request === request && this.port.current();
  }

  private applyPage(page: CallHistoryPage, request: AbortController): void {
    if (!this.owns(request)) return;
    const items = new Map(this.state.items.map(entry => [`${entry.conversationId}/${entry.callId}`, entry]));
    for (const entry of page.content) {
      const key = `${entry.conversationId}/${entry.callId}`;
      const existing = items.get(key);
      if (!existing || entry.version > existing.version) items.set(key, entry);
    }
    const limited = items.size > 250 || (page.hasNext && (items.size >= 250 || this.seen.size >= 128
      || (page.nextCursor !== null && this.seen.has(page.nextCursor))));
    if (page.nextCursor) this.seen.add(page.nextCursor);
    this.cursor = page.nextCursor;
    this.state = { ...this.state, items: Array.from(items.values()).slice(0, 250), loading: false,
      hasNext: page.hasNext && !limited, limited };
    this.port.changed(this.state);
  }

  private failed(error: unknown, request: AbortController, continuing = false): void {
    if (!this.owns(request)) return;
    const status = (error as { response?: { status?: number } })?.response?.status;
    const inaccessible = status === 401 || status === 403 || status === 404;
    const transient = status === undefined || status >= 500 || status === 408 || status === 429;
    if (inaccessible) this.listBeforeDetail = null;
    const retained = continuing && transient ? this.state : emptyHistoryReading();
    this.state = { ...retained, selected: this.state.selected, loading: false,
      error: status === 401 || status === 403 ? 'forbidden' : status === 404 ? 'missing' : 'unavailable' };
    this.port.changed(this.state);
  }
}
