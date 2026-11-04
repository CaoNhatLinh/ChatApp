'use client';

import { useId, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { Button } from '@/shared/ui';
import { uploadFiles } from '@/features/messenger/api/messenger.api';

export type StickerCopy = (vi: string, en: string) => string;
export interface ArtworkDraft { assetId: string; url?: string }

export function StickerArtworkUpload({ label, value, onChange, disabled, onBusy, copy }: {
  label: string; value: ArtworkDraft | null; onChange: (value: ArtworkDraft) => void;
  disabled: boolean; onBusy: (busy: boolean) => void; copy: StickerCopy;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);
  const [broken, setBroken] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | undefined>(value?.url);
  const brokenPreview = broken && previewRef.current === value?.url;
  async function upload(file: File | undefined) {
    if (!file || busy || disabled) return;
    if (!['image/png', 'image/webp', 'image/jpeg', 'image/gif'].includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
      setError('invalid'); return;
    }
    setBusy(true); onBusy(true); setError(null);
    try {
      const uploaded = await uploadFiles([file]);
      const image = uploaded?.[0];
      if (!image?.assetId || !image.url) throw new Error('Upload did not return an asset');
      setBroken(false); previewRef.current = image.url;
      onChange({ assetId: image.assetId, url: image.url });
    } catch { setError('failed'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <div className="space-y-2">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <div className="flex flex-wrap items-center gap-4">
      {value?.url && !brokenPreview ? <img src={value.url} alt="" className="h-20 w-20 object-contain" onError={() => { previewRef.current = value.url; setBroken(true); }} /> : <ImageOff className="h-14 w-14 p-3 text-muted-foreground" aria-label={copy('Ảnh chưa khả dụng', 'Image unavailable')} />}
      <input ref={fileInput} id={id} type="file" accept="image/png,image/webp,image/jpeg,image/gif" disabled={disabled || busy} className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
      <Button type="button" variant="outline" loading={busy} disabled={disabled} onClick={() => fileInput.current?.click()}>{copy('Tải ảnh lên', 'Upload artwork')}</Button>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">{copy('PNG, WebP, JPG hoặc GIF; tối đa 2 MB, mỗi chiều tối đa 1024 px. Máy chủ kiểm tra ảnh khi lưu.', 'PNG, WebP, JPG or GIF; up to 2 MB and 1024 px per side. The server validates artwork on save.')}</p>
    {busy ? <p role="status" className="text-sm">{copy('Đang tải ảnh lên…', 'Uploading artwork…')}</p> : null}
    {error ? <p role="alert" className="text-sm text-destructive">{error === 'invalid' ? copy('Chọn ảnh đúng định dạng và không quá 2 MB.', 'Choose a supported image no larger than 2 MB.') : copy('Không tải được ảnh lên. Kiểm tra kết nối và cấu hình lưu trữ, rồi thử lại.', 'Upload failed. Check your connection and storage configuration, then retry.')}</p> : null}
  </div>;
}
