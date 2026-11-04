import type { Attachment } from '../types/messenger.types';
import type { MediaUploadInspection } from '../api/messenger.api';
import type { ComposerUploadIdentity, createComposerUploadIdentity } from './composerUploadIdentity';

type UploadFiles = (files: File[], signal?: AbortSignal, uploadIds?: readonly string[]) => Promise<Attachment[] | undefined>;

interface UploadRecovery {
  identity: ReturnType<typeof createComposerUploadIdentity>;
  inspect: (uploadId: string, signal: AbortSignal) => Promise<MediaUploadInspection | null>;
}

type UnavailableUploadStatus = 'QUARANTINED' | 'DELETING' | 'DELETED';

export class ComposerUploadUnavailableError extends Error {
  constructor(readonly file: File, readonly status: UnavailableUploadStatus) {
    super('Stored upload is no longer available');
    this.name = 'ComposerUploadUnavailableError';
  }
}

/** Attachment results are mount-local. Only upload identities survive a tab reload. */
export function createComposerUploadCache(upload: UploadFiles, recovery: UploadRecovery) {
  const confirmed = new Map<File, Attachment>();
  const needsInspection = new Set<File>();
  const identities = new Map<File, ComposerUploadIdentity>();
  const protectedIdentities = new Set<File>();
  const pending = new Map<File, { controller: AbortController; promise: Promise<Attachment> }>();
  let disposed = false;
  const aborted = () => new DOMException('Composer upload cancelled', 'AbortError');

  function assertActive(signal: AbortSignal) {
    if (disposed || signal.aborted) throw aborted();
  }

  async function inspectFile(file: File, uploadId: string, signal: AbortSignal) {
    const inspection = await recovery.inspect(uploadId, signal);
    assertActive(signal);
    if (inspection?.status === 'QUARANTINED' || inspection?.status === 'DELETING') {
      protectedIdentities.add(file);
    } else if (inspection) {
      protectedIdentities.delete(file);
    }
    if (inspection && inspection.status !== 'READY' && inspection.status !== 'PENDING') {
      throw new ComposerUploadUnavailableError(file, inspection.status);
    }
    return inspection;
  }

  async function recoverFile(file: File, signal: AbortSignal): Promise<Attachment> {
    const previous = identities.get(file);
    const identity = previous ?? await recovery.identity.allocate(file, signal);
    if (!previous && !disposed && signal.aborted) recovery.identity.release(identity);
    assertActive(signal);
    identities.set(file, identity);
    const cached = confirmed.get(file);
    if (cached) {
      const inspection = await inspectFile(file, identity.uploadId, signal);
      if (inspection?.status !== 'READY' || inspection.file.assetId !== cached.assetId
          || inspection.file.attachmentId !== cached.attachmentId) {
        throw new Error('Confirmed upload could not be revalidated');
      }
      needsInspection.delete(file);
      return cached;
    }
    if (previous || identity.reused) {
      const inspection = await inspectFile(file, identity.uploadId, signal);
      if (inspection?.status === 'READY') return inspection.file;
    }
    const result = await upload([file], signal, [identity.uploadId]);
    assertActive(signal);
    if (result?.length !== 1) throw new Error('Canonical upload must return exactly one attachment');
    return result[0];
  }

  const resolveFile = (file: File): Promise<Attachment> => {
    if (disposed) return Promise.reject(aborted());
    const cached = confirmed.get(file);
    if (cached && !needsInspection.has(file)) return Promise.resolve({ ...cached });
    const existing = pending.get(file);
    if (existing) return existing.promise.then(attachment => ({ ...attachment }));
    const controller = new AbortController();
    const promise = (async () => {
      try {
        const attachment = { ...await recoverFile(file, controller.signal) };
        assertActive(controller.signal);
        confirmed.set(file, attachment);
        return { ...attachment };
      } catch (error) {
        if (disposed || controller.signal.aborted) throw aborted();
        throw error;
      } finally {
        if (pending.get(file)?.controller === controller) pending.delete(file);
      }
    })();
    pending.set(file, { controller, promise });
    return promise;
  };

  return {
    async resolve(files: readonly File[]): Promise<Attachment[]> {
      if (files.length > 10 || new Set(files).size !== files.length) throw new Error('Invalid composer file selection');
      const attachments: Attachment[] = [];
      for (const file of files) attachments.push(await resolveFile(file));
      return attachments;
    },
    getConfirmedUploadIds(files: readonly File[]): string[] {
      return files.map(file => {
        const identity = identities.get(file);
        if (!identity || !confirmed.has(file)) throw new Error('Missing confirmed composer upload identity');
        return identity.uploadId;
      });
    },
    invalidateConfirmed(files: readonly File[]) {
      for (const file of files) if (confirmed.has(file)) needsInspection.add(file);
    },
    forget(file: File) {
      confirmed.delete(file);
      needsInspection.delete(file);
      pending.get(file)?.controller.abort();
      pending.delete(file);
      const identity = identities.get(file);
      const preserveIdentity = protectedIdentities.delete(file);
      if (identity) recovery.identity.release(identity, preserveIdentity);
      identities.delete(file);
    },
    dispose() {
      disposed = true;
      for (const entry of pending.values()) entry.controller.abort();
      pending.clear();
      confirmed.clear();
      needsInspection.clear();
      identities.clear();
      protectedIdentities.clear();
    },
  };
}
