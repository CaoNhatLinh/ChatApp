import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { GiphyGif } from '../api/giphy.api';
import { Button } from '@/shared/ui/Button';
import { localizeText } from '@/shared/i18n';

export function GifSearchResult({ gif, animate, disabled, onSend }: { gif: GiphyGif; animate: boolean; disabled: boolean; onSend: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const selectionRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const image = animate ? gif.preview : gif.still;
  const failed = Boolean(image && failedUrl === image.url);
  useEffect(() => {
    if (restoreFocus.current && !failed) { restoreFocus.current = false; selectionRef.current?.focus(); }
  }, [failed]);
  return <div className="min-w-0">
    <Button ref={selectionRef} type="button" variant="ghost" className="h-auto min-h-24 w-full min-w-0 flex-col gap-1 p-1" aria-label={gif.title || localizeText('Gửi GIF')}
      disabled={disabled || !image || failed} onClick={onSend}>
      {image && !failed ? <img src={image.url} alt={gif.title || 'GIF'} width={image.width} height={image.height} loading="lazy" referrerPolicy="no-referrer" className="h-24 w-full rounded-sm object-contain"
        onError={() => setFailedUrl(image.url)} /> : <ImageOff size={28} aria-hidden="true" />}
      <span className="w-full truncate text-xs">{gif.title || 'GIF'}</span>
    </Button>
    {failed ? <div className="space-y-1 text-xs"><p>{localizeText('Không tải được ảnh xem trước.')}</p><Button type="button" size="sm" variant="outline" onClick={() => {
      restoreFocus.current = true; setFailedUrl(null);
    }}>{localizeText('Thử lại')}</Button></div> : null}
  </div>;
}
