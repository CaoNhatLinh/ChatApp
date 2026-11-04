const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_FILE_OCCURRENCES = 10;
const UPLOAD_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ComposerUploadIdentity {
  readonly uploadId: string;
  readonly reused: boolean;
  readonly storageKey: string;
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function fingerprint(file: File, signal: AbortSignal): Promise<string> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) throw new Error('File must contain between 1 byte and 10 MB');
  signal.throwIfAborted();
  const bytes = await file.arrayBuffer();
  signal.throwIfAborted();
  const checksum = await sha256(bytes);
  signal.throwIfAborted();
  const metadata = new TextEncoder().encode(JSON.stringify([file.name, file.type, checksum]));
  return sha256(metadata.buffer);
}

/** A composer owns its current slots. Storage retains only IDs keyed by a digest. */
export function createComposerUploadIdentity(userId: string, conversationId: string) {
  const prefix = `noi:composer-upload:v1:${encodeURIComponent(userId)}:${encodeURIComponent(conversationId)}:`;
  const occupied = new Map<string, ComposerUploadIdentity>();

  function findSlot(hash: string, storage: Storage): { storageKey: string; saved: string | null } {
    let vacant: string | undefined;
    for (let slot = 0; slot < MAX_FILE_OCCURRENCES; slot++) {
      const storageKey = `${prefix}${hash}:${slot}`;
      if (occupied.has(storageKey)) continue;
      const saved = storage.getItem(storageKey);
      if (saved !== null) return { storageKey, saved };
      vacant ??= storageKey;
    }
    if (vacant === undefined) throw new Error('Too many copies of the same file');
    return { storageKey: vacant, saved: null };
  }

  async function allocate(file: File, signal: AbortSignal): Promise<ComposerUploadIdentity> {
    const hash = await fingerprint(file, signal);
    signal.throwIfAborted();
    const storage = window.sessionStorage;
    const { storageKey, saved } = findSlot(hash, storage);
    if (saved !== null && !UPLOAD_ID_PATTERN.test(saved)) throw new Error('Invalid stored upload identity');
    const uploadId = saved ?? crypto.randomUUID();
    if (saved === null) storage.setItem(storageKey, uploadId);
    const identity = { uploadId, reused: saved !== null, storageKey };
    occupied.set(storageKey, identity);
    return identity;
  }

  function release(identity: ComposerUploadIdentity, preserveIdentity = false): void {
    if (occupied.get(identity.storageKey) !== identity) return;
    occupied.delete(identity.storageKey);
    if (preserveIdentity) return;
    try {
      const storage = window.sessionStorage;
      if (storage.getItem(identity.storageKey) === identity.uploadId) storage.removeItem(identity.storageKey);
    } catch {
      // A confirmed send or explicit removal must not fail because storage is unavailable.
    }
  }

  return { allocate, release };
}
