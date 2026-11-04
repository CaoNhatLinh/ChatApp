import { useCallback, useEffect, useRef } from 'react';
import { isAxiosError } from 'axios';
import { createComposerUploadCache } from '../model/composerUploadCache';
import { createComposerUploadIdentity } from '../model/composerUploadIdentity';
import { inspectMediaUpload } from '../api/messenger.api';
import { useMessengerStore } from '../model/messenger.store';
import type { Attachment, SendMessageRequest } from '../types/messenger.types';

interface ComposerSendRecoveryOptions {
  userId?: string;
  conversationId: string | null;
  contextKey: string;
  upload: (files: File[], signal?: AbortSignal, uploadIds?: readonly string[]) => Promise<Attachment[] | undefined>;
  onConfirmed: (confirmation: { clearDraft: boolean; files: readonly File[] }) => void;
}

/** Owned by the actor/room-keyed composer. Draft files stay in memory. */
export function useComposerSendRecovery(options: ComposerSendRecoveryOptions) {
  const latest = useRef(options);
  latest.current = options;
  const active = useRef(true);
  const revision = useRef(0);
  const cache = useRef<ReturnType<typeof createComposerUploadCache> | null>(null);
  const pending = useRef<{ request: Readonly<SendMessageRequest>; revision: number; contextKey: string; files: readonly File[] } | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      cache.current?.dispose();
      cache.current = null;
      pending.current = null;
    };
  }, []);

  useEffect(() => useMessengerStore.subscribe(state => {
    const attempt = pending.current;
    if (!active.current || !attempt || !options.userId || !options.conversationId) return;
    const confirmed = state.messages[options.conversationId]?.some(message =>
      message.clientMessageId === attempt.request.clientMessageId && message.sender.userId === options.userId
      && !message.messageId.startsWith('temp-'));
    if (!confirmed) return;
    pending.current = null;
    for (const file of attempt.files) cache.current?.forget(file);
    latest.current.onConfirmed({
      clearDraft: revision.current === attempt.revision && latest.current.contextKey === attempt.contextKey,
      files: attempt.files,
    });
  }), [options.conversationId, options.userId]);

  const changed = useCallback(() => { revision.current++; }, []);
  const forget = useCallback((file: File) => { revision.current++; cache.current?.forget(file); }, []);
  const isActive = useCallback(() => active.current, []);
  const begin = useCallback(() => {
    const started = latest.current;
    const startedRevision = revision.current;
    let files: readonly File[] = [];
    let preparedRequest: Readonly<SendMessageRequest> | undefined;
    const isSameUploadScope = () => active.current && latest.current.userId === started.userId
      && latest.current.conversationId === started.conversationId;
    const isCurrent = () => isSameUploadScope() && revision.current === startedRevision
      && latest.current.contextKey === started.contextKey;
    return {
      isCurrent,
      resolve: async (selected: readonly File[]) => {
        if (!isCurrent()) throw new DOMException('Composer changed', 'AbortError');
        if (selected.length === 0) return [];
        if (!started.userId || !started.conversationId) throw new Error('Missing upload owner or conversation');
        files = [...selected];
        cache.current ??= createComposerUploadCache(started.upload, {
          identity: createComposerUploadIdentity(started.userId, started.conversationId),
          inspect: inspectMediaUpload,
        });
        return cache.current.resolve(selected);
      },
      getConfirmedUploadIds: () => {
        if (!isCurrent()) throw new DOMException('Composer changed', 'AbortError');
        return cache.current?.getConfirmedUploadIds(files) ?? [];
      },
      prepared: (request: Readonly<SendMessageRequest>) => {
        if (!isCurrent()) throw new DOMException('Composer changed', 'AbortError');
        preparedRequest = request;
        pending.current = { request, revision: startedRevision, contextKey: started.contextKey, files };
      },
      rejected: (error: unknown) => {
        if (!preparedRequest || pending.current?.request !== preparedRequest || !isSameUploadScope()) return;
        const status = isAxiosError(error) ? error.response?.status : undefined;
        if (status === 403 || status === 409) cache.current?.invalidateConfirmed(files);
      },
    };
  }, []);
  return { begin, changed, forget, isActive };
}
