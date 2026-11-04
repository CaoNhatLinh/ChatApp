interface PendingReport {
  fingerprint: string;
  key: string;
  createdAt: number;
}

const STORAGE_KEY = 'noi:report-retry:v1';
const MAX_PENDING_REPORTS = 12;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isCurrentReport = (entry: unknown, now: number): entry is PendingReport =>
  Boolean(entry && typeof entry === 'object'
    && 'fingerprint' in entry && typeof entry.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(entry.fingerprint)
    && 'key' in entry && typeof entry.key === 'string' && UUID_V4.test(entry.key)
    && 'createdAt' in entry && typeof entry.createdAt === 'number'
    && entry.createdAt <= now && now - entry.createdAt < RETRY_WINDOW_MS);

const readPendingReports = (now: number): PendingReport[] | undefined => {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored || stored.length > 4_096) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(entry => isCurrentReport(entry, now)).slice(0, MAX_PENDING_REPORTS) : [];
  } catch {
    return undefined;
  }
};

const writePendingReports = (pending: PendingReport[]): void => {
  try {
    if (pending.length) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // The open form can still retry when storage is restricted.
  }
};

export const clearPendingReportKeys = (): void => writePendingReports([]);

export const reportDraftFingerprint = async (reporterId: string, draft: string): Promise<string | undefined> => {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([reporterId, draft])));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return undefined;
  }
};

export const reserveReportRetryKey = (fingerprint: string, proposedKey: string): string => {
  const now = Date.now();
  const pending = readPendingReports(now);
  if (!pending) return proposedKey;
  const existing = pending.find(entry => entry.fingerprint === fingerprint);
  if (existing) return existing.key;
  writePendingReports([{ fingerprint, key: proposedKey, createdAt: now }, ...pending].slice(0, MAX_PENDING_REPORTS));
  return proposedKey;
};

export const completeReportRetry = (fingerprint: string, key: string): void => {
  const pending = readPendingReports(Date.now());
  if (!pending) return;
  writePendingReports(pending.filter(entry => entry.fingerprint !== fingerprint || entry.key !== key));
};
