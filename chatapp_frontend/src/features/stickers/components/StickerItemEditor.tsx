'use client';

import { useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { Button, ConfirmDialog, Input, Textarea } from '@/shared/ui';
import { createSticker, getAdminSticker, getAdminStickerPack, updateSticker } from '../api/stickers.api';
import type { Sticker, StickerPack } from '../api/stickers.api';
import { StickerCommandAttempt } from '../model/stickerCommandAttempt';
import { StickerArtworkUpload } from './StickerArtworkUpload';
import { StickerArtworkPreview } from './StickerArtworkPreview';
import type { ArtworkDraft, StickerCopy } from './StickerArtworkUpload';
import { classifyStickerFailure, stickerErrorCopy } from './stickerFormError';
import type { StickerFormError } from './stickerFormError';

export function StickerItemEditor({ stickerId, sticker, pack, copy, blocked, onBusy, onSaved, onCancel, titleRef }: {
  stickerId: string; sticker?: Sticker; pack: StickerPack; copy: StickerCopy; blocked: boolean;
  onBusy: (busy: boolean) => void; onSaved: (pack: StickerPack) => void; onCancel: () => void;
  titleRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [name, setName] = useState(sticker?.name ?? '');
  const [order, setOrder] = useState(String(sticker?.sortOrder ?? 0));
  const [active, setActive] = useState(sticker?.isActive ?? false);
  const [reviewed, setReviewed] = useState(false);
  const [reason, setReason] = useState('');
  const [artwork, setArtwork] = useState<ArtworkDraft | null>(sticker?.image ? { assetId: sticker.image.assetId, url: sticker.image.url } : null);
  const [revision, setRevision] = useState(pack.revision);
  const [latest, setLatest] = useState<Sticker>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<StickerFormError | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);
  const attempt = useRef(new StickerCommandAttempt());
  const locked = saving || uploading || reloading || error === 'uncertain' || error === 'refresh';
  const requiresReview = active && !(latest ?? sticker)?.isActive;
  const validOrder = /^\d{1,3}$/.test(order) && Number(order) <= 999;

  async function reload() {
    setReloading(true); onBusy(true);
    try {
      if (sticker) {
        const current = await getAdminSticker(pack.stickerPackId, stickerId);
        setRevision(current.packRevision); setLatest(current.sticker); setReviewed(false);
      } else {
        const current = await getAdminStickerPack(pack.stickerPackId); setRevision(current.revision);
      }
      setError(null);
    }
    catch (failure) { setError(classifyStickerFailure(failure) === 'missing' ? 'missing' : 'conflict'); }
    finally { setReloading(false); onBusy(false); }
  }
  async function save(confirmed = false) {
    const assetId = artwork?.assetId ?? '';
    if (saving || uploading || !name.trim() || !reason.trim() || !validOrder || (!sticker && !assetId)) return;
    if ((latest ?? sticker)?.isActive && !active && !confirmed) { setConfirmHide(true); return; }
    setConfirmHide(false); setSaving(true); onBusy(true); setError(null);
    const draft = { expectedRevision: revision, name: name.trim(), sortOrder: Number(order), isActive: active, artworkReviewed: reviewed, reason: reason.trim() };
    let remainLocked = false;
    try {
      const result = sticker
        ? await updateSticker(pack.stickerPackId, stickerId, attempt.current.prepare(`${pack.stickerPackId}/${stickerId}`, draft))
        : await createSticker(pack.stickerPackId, attempt.current.prepare(`${pack.stickerPackId}/${stickerId}`, { ...draft, stickerId, assetId }));
      attempt.current.complete(result.commandId);
      try { onSaved(await getAdminStickerPack(pack.stickerPackId)); }
      catch { setError('refresh'); remainLocked = true; }
    } catch (failure) { const classified = classifyStickerFailure(failure); setError(classified); remainLocked = classified === 'uncertain'; }
    finally { setSaving(false); onBusy(remainLocked); }
  }
  async function reloadCommitted() {
    setReloading(true); onBusy(true);
    try { onSaved(await getAdminStickerPack(pack.stickerPackId)); }
    catch { setError('refresh'); }
    finally { setReloading(false); onBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void save(); }
  return <form onSubmit={submit} aria-labelledby="sticker-item-title" className="space-y-4 rounded-xl bg-secondary/45 p-4 sm:p-5">
    <div className="flex items-center gap-4">
      {sticker ? <div className="w-20 shrink-0 rounded-lg bg-card"><StickerArtworkPreview key={sticker.image?.url} url={sticker.image?.url} alt={sticker.name} copy={copy} /></div> : null}
      <div className="min-w-0">
        <h4 ref={titleRef} tabIndex={-1} id="sticker-item-title" className="focus-ring scroll-mt-24 font-semibold">{sticker ? copy('Chỉnh sửa sticker', 'Edit sticker') : copy('Sticker mới', 'New sticker')}</h4>
        {sticker ? <p className="mt-1 break-words text-sm text-muted-foreground">{sticker.name}</p> : null}
      </div>
    </div>
    <fieldset disabled={locked || blocked} className="space-y-4">
      <label htmlFor="sticker-item-name" className="block space-y-2"><span className="text-sm font-medium">{copy('Tên sticker', 'Sticker name')}</span><Input id="sticker-item-name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      {!sticker ? <StickerArtworkUpload label={copy('Hình sticker', 'Sticker artwork')} value={artwork} onChange={setArtwork} disabled={locked || blocked} copy={copy} onBusy={busy => { setUploading(busy); onBusy(busy); }} /> : null}
      <label htmlFor="sticker-item-order" className="block space-y-2"><span className="text-sm font-medium">{copy('Thứ tự trong bộ', 'Order in pack')}</span><Input id="sticker-item-order" type="number" required min={0} max={999} step={1} value={order} onChange={event => setOrder(event.target.value)} /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />{copy('Cho phép chọn sticker này', 'Make this sticker available')}</label>
      {requiresReview ? <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>{copy('Tôi đã kiểm tra hình và có quyền sử dụng.', 'I reviewed the artwork and have permission to use it.')}</span></label> : null}
      <label htmlFor="sticker-item-reason" className="block space-y-2"><span className="text-sm font-medium">{copy('Lý do chỉnh sticker', 'Reason for sticker change')}</span><Textarea id="sticker-item-reason" required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
    </fieldset>
    {error ? <p role="alert" className="text-sm leading-6 text-destructive">{stickerErrorCopy(error, copy)}</p> : null}
    {latest ? <details open className="space-y-3 text-sm"><summary>{copy('Sticker đang lưu trên máy chủ', 'Current server sticker')}</summary><dl className="space-y-2"><div><dt className="text-muted-foreground">{copy('Tên sticker', 'Sticker name')}</dt><dd>{latest.name}</dd></div><div><dt className="text-muted-foreground">{copy('Thứ tự', 'Order')}</dt><dd>{latest.sortOrder}</dd></div><div><dt className="text-muted-foreground">{copy('Trạng thái', 'Status')}</dt><dd>{latest.isActive ? copy('Đã công bố', 'Published') : copy('Chưa công bố', 'Unpublished')}</dd></div><div><dt className="text-muted-foreground">{copy('Hình sticker', 'Sticker artwork')}</dt><dd>{latest.image ? <img src={latest.image.url} alt={latest.name} className="h-20 w-20 object-contain" /> : copy('Ảnh không khả dụng', 'Image unavailable')}</dd></div></dl><p className="text-muted-foreground">{copy('Bản nháp của bạn được giữ nguyên. So sánh trước khi lưu lại.', 'Your draft is preserved. Compare it before saving again.')}</p></details> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" loading={saving} disabled={blocked || uploading || reloading || !name.trim() || !reason.trim() || !validOrder || (!sticker && !artwork) || error === 'missing' || error === 'conflict' || error === 'refresh' || (requiresReview && !reviewed)}>{copy('Lưu sticker', 'Save sticker')}</Button>
      {error === 'conflict' || error === 'refresh' ? <Button type="button" variant="outline" loading={reloading} onClick={() => void (error === 'refresh' ? reloadCommitted() : reload())}>{copy('Tải bản mới', 'Load latest version')}</Button> : null}
      <Button type="button" variant="ghost" disabled={locked || blocked} onClick={onCancel}>{copy('Hủy', 'Cancel')}</Button>
    </div>
    <ConfirmDialog open={confirmHide} onOpenChange={setConfirmHide} title={copy('Gỡ sticker khỏi danh mục?', 'Remove sticker from the catalog?')} description={copy('Người dùng không thể chọn hình này nữa. Tệp đã lưu không bị xóa.', 'Users will no longer be able to select this artwork. The stored file is not deleted.')} confirmLabel={copy('Gỡ khỏi danh mục', 'Remove from catalog')} destructive onConfirm={() => save(true)} />
  </form>;
}
