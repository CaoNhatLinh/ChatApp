'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Attachment, Message } from '../../types/messenger.types';
import { getMessageAttachments, type MessageAttachmentView } from '../../api/message-attachments.api';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

const localView = (item: Attachment, index: number): MessageAttachmentView => ({
  attachmentId: item.attachmentId ?? String(index), assetId: item.assetId ?? null, fileName: item.fileName,
  mimeType: item.contentType ?? item.mimeType ?? '', byteSize: item.fileSize, width: item.width ?? null,
  height: item.height ?? null, durationMs: item.durationMs ?? null, spoiler: false, status: 'READY',
  url: item.url, thumbnailUrl: item.thumbnailUrl ?? item.mediumUrl ?? null,
});

function PlayableAttachment({ item, link, video }: { item: MessageAttachmentView; link: ReactNode; video: boolean }) {
  const media = useRef<HTMLMediaElement | null>(null);
  const retryButton = useRef<HTMLButtonElement | null>(null);
  const retrying = useRef(false);
  const [state, setState] = useState<'idle' | 'failed' | 'retrying'>('idle');
  const retry = () => {
    if (!media.current || retrying.current) return;
    retrying.current = true;
    setState('retrying');
    media.current.preload = 'metadata';
    media.current.load();
  };
  const player = {
    ref: (element: HTMLMediaElement | null) => { media.current = element; },
    controls: true,
    preload: 'none',
    tabIndex: 0,
    'aria-label': item.fileName,
    src: item.url ?? undefined,
    onError: () => { retrying.current = false; setState('failed'); },
    onLoadedMetadata: () => {
      if (retrying.current && document.activeElement === retryButton.current) media.current?.focus({ preventScroll: true });
      retrying.current = false;
      setState('idle');
    },
  } as const;

  return <div className="space-y-2">
    {video ? <video {...player} playsInline className="max-h-72 w-full rounded-lg" poster={item.thumbnailUrl ?? undefined} />
      : <audio {...player} className="w-full" />}
    {state !== 'idle' ? <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm">{localizeText(state === 'retrying' ? 'Đang tải lại tệp…' : video ? 'Không phát được video.' : 'Không phát được âm thanh.')}</p>
      <Button ref={retryButton} type="button" size="sm" variant="outline" aria-disabled={state === 'retrying'} onClick={retry}>{localizeText('Thử lại')}</Button>
    </div> : null}
    {link}
  </div>;
}

function AttachmentPreview({ item }: { item: MessageAttachmentView }) {
  const [revealed, setRevealed] = useState(!item.spoiler);
  const [imageState, setImageState] = useState<'thumbnail' | 'original' | 'failed'>(item.thumbnailUrl ? 'thumbnail' : 'original');
  if (item.status === 'UNAVAILABLE' || !item.url) return <div className="rounded-lg border border-border p-3 text-sm">
    <p className="break-words font-medium">{item.fileName}</p><p role="status">{localizeText('Tệp này không còn khả dụng.')}</p>
  </div>;
  if (!revealed) return <Button type="button" variant="outline" className="w-full" onClick={() => setRevealed(true)}>{localizeText('Hiện tệp đính kèm')}</Button>;
  const link = <a href={item.url} target="_blank" rel="noreferrer" className="focus-ring block break-words rounded-lg border border-border p-3 text-sm underline underline-offset-4">{item.fileName}</a>;
  if (item.mimeType.startsWith('image/')) return imageState === 'failed' ? <div>
    <p role="status" className="text-sm">{localizeText('Không tải được ảnh.')}</p>{link}
    <Button type="button" size="sm" variant="outline" onClick={() => setImageState('original')}>{localizeText('Thử lại')}</Button>
  </div> : <a href={item.url} target="_blank" rel="noreferrer" className="focus-ring block overflow-hidden rounded-lg border border-border/30">
    <img src={imageState === 'thumbnail' ? item.thumbnailUrl ?? item.url : item.url} alt={item.fileName}
      width={item.width ?? undefined} height={item.height ?? undefined} loading="lazy" className="max-h-64 w-full object-contain"
      onError={() => setImageState(value => value === 'thumbnail' ? 'original' : 'failed')} />
  </a>;
  const video = item.mimeType.startsWith('video/');
  if (video || item.mimeType.startsWith('audio/')) return <PlayableAttachment item={item} link={link} video={video} />;
  return link;
}

export function MessageAttachments({ message }: { message: Message }) {
  const actorId = useAuthStore(state => state.user?.userId);
  const generation = getSessionGeneration();
  if (message.isDeleted || !message.hasAttachments && !message.attachments?.length) return null;
  return <AttachmentReader key={`${actorId}/${generation}/${message.conversationId}/${message.messageBucket}/${message.messageId}`}
    message={message} actorId={actorId} />;
}

function AttachmentReader({ message, actorId }: { message: Message; actorId?: string }) {
  useAppLocale();
  const { conversationId, messageId, messageBucket, attachments } = message;
  const hasLocal = Boolean(attachments?.length && (messageId.startsWith('temp-') || message.status === 'sending' || message.status === 'failed'));
  const local = hasLocal ? attachments?.map(localView) ?? null : null;
  const [items, setItems] = useState<MessageAttachmentView[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [cursor, setCursor] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const seen = useRef(new Set<string>());
  const host = useRef<HTMLDivElement>(null);
  const load = (after: string | null) => {
    if (!actorId || !messageBucket || messageId.startsWith('temp-')) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState('loading');
    void getMessageAttachments({ conversationId, messageId, messageBucket }, after, controller.signal).then(page => {
      if (controller.signal.aborted) return;
      if (page.nextCursor && seen.current.has(page.nextCursor)) throw new Error('Attachment cursor cycle');
      if (page.nextCursor) seen.current.add(page.nextCursor);
      setItems(previous => after ? [...previous, ...page.content.filter(item => !previous.some(existing => existing.attachmentId === item.attachmentId))] : page.content);
      setCursor(page.nextCursor); setState('ready');
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403 || status === 404) { setItems([]); setCursor(null); setState('unavailable'); }
      else setState('error');
    });
  };
  const loadRef = useRef(load); loadRef.current = load;
  useEffect(() => {
    if (hasLocal || !actorId || !messageBucket || messageId.startsWith('temp-')) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); loadRef.current(null);
    });
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); request.current?.abort(); };
  }, [actorId, messageBucket, messageId, hasLocal]);
  const visible = local ?? items;
  return <div ref={host} className="mt-3 space-y-2" aria-label={localizeText('Tệp đính kèm')} aria-busy={!local && state === 'loading'}>
    {visible.map(item => <AttachmentPreview key={`${item.attachmentId}/${item.url}`} item={item} />)}
    {!local ? <>
      {state === 'loading' ? <p role="status" className="text-sm">{localizeText('Đang tải tệp đính kèm…')}</p> : null}
      {state === 'unavailable' ? <p role="status" className="text-sm">{localizeText('Không còn quyền xem tệp của tin nhắn này.')}</p> : null}
      {state === 'error' || state === 'ready' && !items.length ? <div>
        <p role="status" className="text-sm">{localizeText(state === 'error' ? 'Chưa tải được tệp đính kèm.' : 'Tệp đính kèm chưa sẵn sàng.')}</p>
        <Button type="button" size="sm" variant="outline" onClick={() => { if (!cursor) seen.current.clear(); load(cursor); }}>{localizeText('Thử lại')}</Button>
      </div> : null}
      {state === 'ready' && cursor ? <Button type="button" size="sm" variant="outline" onClick={() => load(cursor)}>{localizeText('Tải thêm tệp')}</Button> : null}
    </> : null}
  </div>;
}
