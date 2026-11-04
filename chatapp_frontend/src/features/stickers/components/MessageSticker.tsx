import { useEffect, useRef, useState } from 'react';
import { Sticker as StickerIcon } from 'lucide-react';
import { getMessageSticker, type MessageStickerArtwork } from '../api/stickers.api';
import type { Message } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Button } from '@/shared/ui/Button';
import { localizeText, useAppLocale } from '@/shared/i18n';

export function MessageSticker({ message }: { message: Message }) {
  const { locale } = useAppLocale();
  const actorId = useAuthStore(state => state.user?.userId);
  const [artwork, setArtwork] = useState<MessageStickerArtwork | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const { conversationId, messageId, messageBucket, stickerId, isDeleted } = message;
  useEffect(() => {
    setArtwork(null);
    setState('loading');
    if (!actorId || !messageBucket || !stickerId || isDeleted) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void getMessageSticker({ conversationId, messageId, messageBucket }, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        if (result.stickerId !== stickerId) { setState('unavailable'); return; }
        setArtwork(result);
        setState(result.image ? 'ready' : 'unavailable');
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const status = (error as { response?: { status?: number } })?.response?.status;
        setState(status === 403 || status === 404 ? 'unavailable' : 'error');
      });
    });
    if (hostRef.current) observer.observe(hostRef.current);
    return () => { controller.abort(); observer.disconnect(); };
  }, [actorId, conversationId, messageId, messageBucket, stickerId, isDeleted, attempt]);

  return <div ref={hostRef} lang={locale} className="flex min-h-24 w-36 max-w-full flex-col items-center justify-center gap-2 text-center sm:w-44" aria-busy={state === 'loading' && Boolean(messageBucket)}>
    {state === 'ready' && artwork?.image ? <img src={artwork.image.url} alt={artwork.name} width={artwork.image.width} height={artwork.image.height}
      className="max-h-44 w-full object-contain" loading="lazy" onError={() => setState('error')} /> : <>
      <StickerIcon className="h-8 w-8" aria-hidden="true" />
      <p className="text-xs" role="status">{localizeText(!messageBucket ? 'Sticker' : state === 'loading' ? 'Đang tải sticker...' : state === 'error' ? 'Không tải được hình sticker.' : 'Hình sticker không còn khả dụng.')}</p>
      {state === 'error' ? <Button type="button" size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>{localizeText('Thử lại')}</Button> : null}
    </>}
  </div>;
}
