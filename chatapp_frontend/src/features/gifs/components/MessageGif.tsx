import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ImageOff } from 'lucide-react';
import { giphyClient, giphyWebKey } from '../api/giphy.client';
import { GiphyError, type GiphyGif } from '../api/giphy.api';
import { GiphyAttribution } from './GiphyAttribution';
import type { Message } from '@/features/messenger/types/messenger.types';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { Button } from '@/shared/ui/Button';
import { localizeText, useAppLocale } from '@/shared/i18n';

type ViewState = 'loading' | 'ready' | 'unavailable' | 'error' | 'unconfigured' | 'rate-limited';

export function MessageGif({ message }: { message: Message }) {
  const { locale } = useAppLocale();
  const actorId = useAuthStore(state => state.user?.userId);
  const reducedMotion = useReducedMotion();
  const [play, setPlay] = useState<boolean | null>(null);
  const [artwork, setArtwork] = useState<GiphyGif | null>(null);
  const [state, setState] = useState<ViewState>('loading');
  const [attempt, setAttempt] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const { conversationId, messageId, messageBucket, isDeleted } = message;
  const provider = message.gif?.provider;
  const providerId = message.gif?.providerGifId;
  const playing = play ?? reducedMotion === false;

  useEffect(() => {
    setArtwork(null); setState('loading');
    if (!giphyWebKey) { setState('unconfigured'); return; }
    if (!actorId || !messageBucket || !providerId || provider !== 'GIPHY' || isDeleted) { setState('unavailable'); return; }
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void giphyClient.get(providerId, controller.signal).then(result => {
        if (controller.signal.aborted) return;
        setArtwork(result);
        setState(result?.preview ? 'ready' : 'unavailable');
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const code = error instanceof GiphyError ? error.code : undefined;
        setState(code === 'UNCONFIGURED' ? 'unconfigured' : code === 'RATE_LIMITED' ? 'rate-limited'
          : code === 'INVALID_INPUT' ? 'unavailable' : 'error');
      });
    });
    if (hostRef.current) observer.observe(hostRef.current);
    return () => { controller.abort(); observer.disconnect(); };
  }, [actorId, conversationId, messageId, messageBucket, provider, providerId, isDeleted, attempt]);

  const image = playing ? artwork?.preview : artwork?.still;
  const label = !messageBucket ? 'GIF' : state === 'unconfigured' ? 'Chưa cấu hình GIF cho ứng dụng.'
    : state === 'loading' ? 'Đang tải GIF…' : state === 'rate-limited' ? 'GIPHY đang giới hạn lượt tải. Bạn thử lại sau nhé.'
      : state === 'error' ? 'Không tải được GIF.' : 'GIF này không còn khả dụng.';

  return <div ref={hostRef} lang={locale} className="flex min-h-24 w-44 max-w-full flex-col items-center gap-2 text-center sm:w-52" aria-busy={state === 'loading' && Boolean(messageBucket)}>
    {state === 'ready' && artwork ? <>
      {image ? <img src={image.url} alt={artwork.title || 'GIF'} width={image.width} height={image.height}
        className="max-h-60 w-full rounded-sm object-contain" loading="lazy" referrerPolicy="no-referrer" onError={() => setState('error')} />
        : <div className="flex min-h-24 items-center gap-2"><ImageOff size={24} aria-hidden="true" /><span>GIF</span></div>}
      <Button type="button" size="sm" variant="outline" onClick={() => setPlay(!playing)}>{localizeText(playing ? 'Tạm dừng GIF' : 'Phát GIF')}</Button>
    </> : <>
      <ImageOff size={28} aria-hidden="true" />
      <p className="text-xs" role="status">{localizeText(label)}</p>
      {state === 'error' || state === 'rate-limited' ? <Button type="button" size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>{localizeText('Thử lại')}</Button> : null}
    </>}
    {giphyWebKey && messageBucket ? <GiphyAttribution /> : null}
  </div>;
}
