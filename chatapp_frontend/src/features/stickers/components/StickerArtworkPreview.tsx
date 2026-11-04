import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { StickerCopy } from './StickerArtworkUpload';

export function StickerArtworkPreview({ url, alt = '', copy }: { url?: string; alt?: string; copy: StickerCopy }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <ImageOff role="img" className="h-20 w-full p-6 text-muted-foreground" aria-label={copy('Ảnh không khả dụng', 'Image unavailable')} />;
  return <img src={url} alt={alt} className="h-20 w-full object-contain" referrerPolicy="no-referrer" decoding="async" onError={() => setBroken(true)} />;
}
