export type GiphyErrorCode = 'UNCONFIGURED' | 'INVALID_INPUT' | 'RATE_LIMITED' | 'UNAVAILABLE' | 'INVALID_RESPONSE';

export class GiphyError extends Error {
  constructor(public readonly code: GiphyErrorCode) { super(code); this.name = 'GiphyError'; }
}

export interface GiphyRendition { url: string; width: number; height: number }
export interface GiphyGif {
  provider: 'GIPHY';
  id: string;
  title: string;
  preview: GiphyRendition | null;
  still: GiphyRendition | null;
}
export interface GiphyPage { content: GiphyGif[]; nextOffset: number | null }
export interface GiphyListOptions { query?: string; offset?: number; locale?: 'vi' | 'en'; signal?: AbortSignal }

const PAGE_SIZE = 24;
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const nonnegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GiphyError('INVALID_RESPONSE');
  return value as Record<string, unknown>;
}

function dimension(value: unknown): number {
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value) || Number(value) < 1 || Number(value) > 4096) {
    throw new GiphyError('INVALID_RESPONSE');
  }
  return Number(value);
}

function rendition(value: unknown): GiphyRendition | null {
  if (value === undefined) return null;
  const image = record(value);
  if (typeof image.url !== 'string' || image.url.length > 4096) throw new GiphyError('INVALID_RESPONSE');
  let url: URL;
  try { url = new URL(image.url); } catch { throw new GiphyError('INVALID_RESPONSE'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !(url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com')
        || url.hostname === 'giphyusercontent.com' || url.hostname.endsWith('.giphyusercontent.com'))) {
    throw new GiphyError('INVALID_RESPONSE');
  }
  // Keep the provider URL verbatim, including all rendition/tracking parameters.
  return { url: image.url, width: dimension(image.width), height: dimension(image.height) };
}

function gif(value: unknown): GiphyGif {
  const item = record(value);
  if (!validId(item.id) || item.type !== 'gif' || typeof item.title !== 'string' || item.title.length > 500) {
    throw new GiphyError('INVALID_RESPONSE');
  }
  const images = record(item.images);
  return { provider: 'GIPHY', id: item.id, title: item.title,
    preview: rendition(images.fixed_width), still: rendition(images.fixed_width_still) };
}

function checkStatus(status: number): void {
  if (status === 200) return;
  if (status === 401 || status === 403) throw new GiphyError('UNCONFIGURED');
  throw new GiphyError(status === 429 ? 'RATE_LIMITED' : 'UNAVAILABLE');
}

function parsePage(body: Record<string, unknown>, offset: number, maximumOffset: number): GiphyPage {
  const pagination = record(body.pagination);
  if (!Array.isArray(body.data) || body.data.length > PAGE_SIZE || pagination.offset !== offset
      || pagination.count !== body.data.length
      || pagination.total_count !== undefined && !nonnegativeInteger(pagination.total_count)) {
    throw new GiphyError('INVALID_RESPONSE');
  }
  const next = offset + body.data.length;
  const total = pagination.total_count;
  const hasNext = body.data.length > 0 && next <= maximumOffset && (total === undefined || next < Number(total));
  // Never filter/sort a provider page; malformed entries fail the page explicitly.
  return { content: body.data.map(gif), nextOffset: hasNext ? next : null };
}

/** Browser-only provider transport. Never uses the authenticated Nối API client. */
export function createGiphyClient(apiKey: string) {
  async function request(path: string, params: Record<string, string>, signal?: AbortSignal) {
    if (!apiKey.trim()) throw new GiphyError('UNCONFIGURED');
    const url = new URL(`https://api.giphy.com/v1/gifs/${path}`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('rating', 'g');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await fetch(url.toString(), { signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    } catch { signal?.throwIfAborted(); throw new GiphyError('UNAVAILABLE'); }
    if (response.status === 404) return null;
    checkStatus(response.status);
    let body: Record<string, unknown>;
    try { body = record(await response.json()); } catch { signal?.throwIfAborted(); throw new GiphyError('INVALID_RESPONSE'); }
    const meta = record(body.meta);
    if (!nonnegativeInteger(meta.status)) throw new GiphyError('INVALID_RESPONSE');
    if (meta.status === 404) return null;
    checkStatus(meta.status);
    return body;
  }

  return {
    async list({ query = '', offset = 0, locale = 'en', signal }: GiphyListOptions = {}): Promise<GiphyPage> {
      const isSearch = query.trim().length > 0;
      const maximumOffset = isSearch ? 4999 : 499;
      if (query.length > 50 || !nonnegativeInteger(offset) || offset > maximumOffset) throw new GiphyError('INVALID_INPUT');
      const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String(offset) };
      if (isSearch) { params.q = query; params.lang = locale; }
      const body = await request(isSearch ? 'search' : 'trending', params, signal);
      if (!body) throw new GiphyError('UNAVAILABLE');
      return parsePage(body, offset, maximumOffset);
    },
    async get(id: string, signal?: AbortSignal): Promise<GiphyGif | null> {
      if (!validId(id)) throw new GiphyError('INVALID_INPUT');
      const body = await request(id, {}, signal);
      if (!body) return null;
      const item = gif(body.data);
      if (item.id !== id) throw new GiphyError('INVALID_RESPONSE');
      return item;
    },
  };
}
