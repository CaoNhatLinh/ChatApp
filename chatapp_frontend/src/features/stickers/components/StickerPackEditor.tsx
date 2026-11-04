'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent, RefObject } from 'react';
import { Button, ConfirmDialog, Input, Textarea } from '@/shared/ui';
import { BrandText } from '@/shared/ui/BrandWord';
import { createStickerPack, getAdminStickerPack, updateStickerPack } from '../api/stickers.api';
import type { StickerPack } from '../api/stickers.api';
import { StickerCommandAttempt } from '../model/stickerCommandAttempt';
import { StickerArtworkUpload } from './StickerArtworkUpload';
import type { ArtworkDraft, StickerCopy } from './StickerArtworkUpload';
import { classifyStickerFailure, stickerErrorCopy } from './stickerFormError';
import type { StickerFormError } from './stickerFormError';

export function StickerPackEditor({ packId, pack, copy, blocked, onBusy, onSaved, titleRef }: {
  packId: string; pack?: StickerPack; copy: StickerCopy; blocked: boolean;
  onBusy: (busy: boolean) => void; onSaved: (pack: StickerPack) => void;
  titleRef?: RefObject<HTMLHeadingElement | null>;
}) {
  const [name, setName] = useState(pack?.name ?? '');
  const [description, setDescription] = useState(pack?.description ?? '');
  const [official, setOfficial] = useState(pack?.isOfficial ?? false);
  const [active, setActive] = useState(pack?.isActive ?? false);
  const [reviewed, setReviewed] = useState(false);
  const [cover, setCover] = useState<ArtworkDraft | null>(pack?.coverAssetId ? { assetId: pack.coverAssetId, url: pack.cover?.url } : null);
  const [reason, setReason] = useState('');
  const [revision, setRevision] = useState(pack?.revision);
  const [latest, setLatest] = useState<StickerPack>();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState<StickerFormError | null>(null);
  const [feedback, setFeedback] = useState<'saved' | 'audit' | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);
  const attempt = useRef(new StickerCommandAttempt());
  const locked = saving || uploading || reloading || error === 'uncertain' || error === 'refresh';
  useEffect(() => {
    onBusy(locked);
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [locked, onBusy]);

  async function reload() {
    setReloading(true);
    try {
      const current = await getAdminStickerPack(packId);
      setRevision(current.revision); setLatest(current); setError(null);
      onSaved(current);
    } catch { setError(previous => previous === 'refresh' ? 'refresh' : 'conflict'); }
    finally { setReloading(false); }
  }

  async function save(confirmed = false) {
    if (saving || uploading || !name.trim() || !reason.trim()) return;
    if (pack?.isActive && !active && !confirmed) { setConfirmHide(true); return; }
    setConfirmHide(false); setSaving(true); setError(null); setFeedback(null);
    const draft = { name: name.trim(), description: description.trim(), coverAssetId: cover?.assetId ?? null, isOfficial: official, reason: reason.trim() };
    try {
      const result = pack && revision
        ? await updateStickerPack(packId, attempt.current.prepare(packId, { ...draft, expectedRevision: revision, isActive: active, artworkReviewed: reviewed }))
        : await createStickerPack(attempt.current.prepare(packId, { ...draft, stickerPackId: packId }));
      attempt.current.complete(result.commandId);
      setReason(''); setReviewed(false); setFeedback(result.auditPending ? 'audit' : 'saved');
      try {
        const current = await getAdminStickerPack(packId);
        setRevision(current.revision); setLatest(current); onSaved(current);
      } catch { setError('refresh'); }
    } catch (failure) { setError(classifyStickerFailure(failure)); }
    finally { setSaving(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void save(); }
  const requiresReview = active && !pack?.isActive;
  return <form onSubmit={submit} className="space-y-4">
    <h3 ref={titleRef} tabIndex={-1} className="text-lg font-semibold outline-none">{pack ? copy('Chỉnh sửa bộ', 'Edit pack') : copy('Bộ mới', 'New pack')}</h3>
    <fieldset disabled={locked || blocked} className="space-y-4">
      <label className="block space-y-2" htmlFor="sticker-pack-name"><span className="text-sm font-medium">{copy('Tên bộ', 'Pack name')}</span><Input id="sticker-pack-name" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
      <label className="block space-y-2" htmlFor="sticker-pack-description"><span className="text-sm font-medium">{copy('Mô tả', 'Description')}</span><Textarea id="sticker-pack-description" maxLength={500} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <StickerArtworkUpload label={copy('Ảnh bìa', 'Cover image')} value={cover} onChange={setCover} disabled={locked || blocked} onBusy={setUploading} copy={copy} />
      {cover ? <Button type="button" variant="ghost" onClick={() => setCover(null)}>{copy('Bỏ ảnh bìa', 'Remove cover')}</Button> : null}
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={official} onChange={event => setOfficial(event.target.checked)} /><BrandText text={copy('Bộ do Nối phát hành', 'Published by Nối')} /></label>
      {pack ? <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />{copy('Công bố bộ', 'Publish pack')}</label> : <p className="text-sm text-muted-foreground">{copy('Bộ mới luôn được lưu ở trạng thái chưa công bố.', 'New packs are always saved unpublished.')}</p>}
      {requiresReview ? <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" required checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>{copy('Tôi đã kiểm tra hình ảnh và có quyền sử dụng. Đây là xác nhận thủ công, không phải kiểm duyệt tự động.', 'I reviewed the artwork and have permission to use it. This is manual review, not automated moderation.')}</span></label> : null}
      <label className="block space-y-2" htmlFor="sticker-pack-reason"><span className="text-sm font-medium">{copy('Lý do thay đổi', 'Reason for change')}</span><Textarea id="sticker-pack-reason" required maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /></label>
    </fieldset>
    {error ? <p role="alert" className="text-sm leading-6 text-destructive">{stickerErrorCopy(error, copy)}</p> : null}
    {feedback ? <p role="status" className="text-sm leading-6">{feedback === 'audit' ? copy('Đã lưu. Nhật ký đang chờ đồng bộ.', 'Saved. Audit export is pending.') : copy('Đã lưu thay đổi.', 'Changes saved.')}</p> : null}
    {latest ? <details open className="text-sm"><summary className="cursor-pointer text-muted-foreground">{copy('Bản đang lưu trên máy chủ', 'Current server version')}</summary><dl className="mt-3 space-y-2 break-words"><div><dt className="text-muted-foreground">{copy('Tên bộ', 'Pack name')}</dt><dd>{latest.name}</dd></div><div><dt className="text-muted-foreground">{copy('Mô tả', 'Description')}</dt><dd>{latest.description || copy('Chưa có mô tả', 'No description')}</dd></div><div><dt className="text-muted-foreground">{copy('Trạng thái', 'Status')}</dt><dd>{latest.isActive ? copy('Đã công bố', 'Published') : copy('Chưa công bố', 'Unpublished')}</dd></div><div><dt className="text-muted-foreground">{copy('Bộ do Nối phát hành', 'Published by Nối')}</dt><dd>{latest.isOfficial ? copy('Có', 'Yes') : copy('Không', 'No')}</dd></div><div><dt className="text-muted-foreground">{copy('Ảnh bìa', 'Cover image')}</dt><dd>{latest.cover ? <img src={latest.cover.url} alt="" className="h-20 w-20 object-contain" /> : latest.coverAssetId ? copy('Ảnh bìa không khả dụng; tệp vẫn được giữ.', 'Cover unavailable; file identity is retained.') : copy('Không có ảnh bìa', 'No cover')}</dd></div></dl><p className="mt-3 text-muted-foreground">{copy('Nội dung bạn nhập vẫn ở trong form. Kiểm tra bản mới trước khi lưu lại.', 'Your draft remains in the form. Review the latest version before saving again.')}</p></details> : null}
    <div className="flex flex-wrap gap-2">
      <Button type="submit" loading={saving} disabled={uploading || blocked || reloading || !name.trim() || !reason.trim() || error === 'conflict' || error === 'refresh' || (requiresReview && !reviewed)}>{copy('Lưu bộ', 'Save pack')}</Button>
      {(pack || error === 'refresh') && (error === 'conflict' || error === 'refresh') ? <Button type="button" variant="outline" loading={reloading} onClick={() => void reload()}>{copy('Tải bản mới', 'Load latest version')}</Button> : null}
    </div>
    <ConfirmDialog open={confirmHide} onOpenChange={setConfirmHide} title={copy('Gỡ bộ khỏi danh mục?', 'Remove pack from the catalog?')} description={copy('Bộ sẽ không xuất hiện trong danh sách chọn. Hình đã lưu không bị xóa.', 'The pack will disappear from the picker. Stored artwork is not deleted.')} confirmLabel={copy('Gỡ khỏi danh mục', 'Remove from catalog')} destructive onConfirm={() => save(true)} />
  </form>;
}
