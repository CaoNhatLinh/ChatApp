'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/shared/ui';
import { listAdminStickers } from '../api/stickers.api';
import type { Sticker, StickerPack } from '../api/stickers.api';
import type { StickerCopy } from './StickerArtworkUpload';
import { StickerItemEditor } from './StickerItemEditor';
import { StickerArtworkPreview } from './StickerArtworkPreview';
import { StickerShelfArt } from './StickerShelfArt';

export function StickerInventory({ pack, copy, blocked, onBusy, onSaved }: {
  pack: StickerPack; copy: StickerCopy; blocked: boolean;
  onBusy: (busy: boolean) => void; onSaved: (pack: StickerPack) => void;
}) {
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<{ id: string; sticker?: Sticker }>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const editorTitle = useRef<HTMLHeadingElement>(null);
  const editorTrigger = useRef<HTMLButtonElement>(null);
  const addSticker = useRef<HTMLButtonElement>(null);
  const editorId = editor?.id;
  useEffect(() => { if (editorId) editorTitle.current?.focus(); }, [editorId]);
  const request = useRef<AbortController | null>(null);
  const retryCursor = useRef<string | undefined>(undefined);
  const load = useCallback(async (after?: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    retryCursor.current = after; setLoading(true); setError(false);
    try {
      const page = await listAdminStickers(pack.stickerPackId, after, controller.signal);
      if (controller.signal.aborted) return;
      setStickers(current => after ? [...current, ...page.content.filter(item => !current.some(existing => existing.stickerId === item.stickerId))] : page.content);
      setCursor(page.nextCursor);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [pack.stickerPackId]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load, pack.revision]);
  function changeBusy(value: boolean) { setBusy(value); onBusy(value); }
  function openEditor(next: { id: string; sticker?: Sticker }, trigger: HTMLButtonElement) {
    editorTrigger.current = trigger;
    setSaved(false);
    setEditor(next);
  }
  function closeEditor() {
    setEditor(undefined);
    requestAnimationFrame(() => {
      const trigger = editorTrigger.current;
      if (trigger?.isConnected && !trigger.disabled) trigger.focus();
      else addSticker.current?.focus();
    });
  }
  function savedItem(current: StickerPack) { closeEditor(); setSaved(true); onSaved(current); }
  return <section className="space-y-4 border-t border-border pt-6" aria-labelledby="sticker-inventory-title">
    <header className="flex flex-wrap items-center justify-between gap-3"><h3 id="sticker-inventory-title" className="font-semibold">{copy('Hình trong bộ', 'Pack artwork')}</h3><Button ref={addSticker} type="button" variant="outline" disabled={blocked || busy} onClick={event => openEditor({ id: crypto.randomUUID() }, event.currentTarget)}><Plus size={16} aria-hidden="true" />{copy('Thêm sticker', 'Add sticker')}</Button></header>
    {editor ? <StickerItemEditor key={editor.id} stickerId={editor.id} sticker={editor.sticker} pack={pack} copy={copy} blocked={blocked} onBusy={changeBusy} onSaved={savedItem} onCancel={closeEditor} titleRef={editorTitle} /> : null}
    {loading ? <p role="status" className="text-sm text-muted-foreground">{copy('Đang tải hình…', 'Loading artwork…')}</p> : null}
    {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{copy('Không tải được hình.', 'Could not load artwork.')}</p><Button type="button" variant="outline" onClick={() => void load(retryCursor.current)}>{copy('Thử lại', 'Retry')}</Button></div> : null}
    {!editor && !loading && !error && stickers.length === 0 ? <div className="admin-sticker-unselected">
      <StickerShelfArt />
      <p>{copy('Bộ này chưa có sticker.', 'This pack has no stickers yet.')}</p>
    </div> : null}
    {saved ? <p role="status" className="text-sm">{copy('Đã lưu sticker.', 'Sticker saved.')}</p> : null}
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">{stickers.map(sticker => <li key={sticker.stickerId} className="min-w-0"><button type="button" disabled={blocked || busy} aria-pressed={editor?.id === sticker.stickerId} onClick={event => openEditor({ id: sticker.stickerId, sticker }, event.currentTarget)} className="w-full space-y-2 rounded-lg p-3 text-left motion-safe:transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary aria-pressed:bg-secondary disabled:opacity-50"><StickerArtworkPreview key={sticker.image?.url} url={sticker.image?.url} copy={copy} /><strong className="block break-words text-sm">{sticker.name}</strong><span className="block text-xs text-muted-foreground">{sticker.isActive ? copy('Đã công bố', 'Published') : copy('Chưa công bố', 'Unpublished')}</span></button></li>)}</ul>
    {cursor ? <Button type="button" variant="outline" loading={loading} disabled={busy || blocked} onClick={() => void load(cursor)}>{copy('Xem thêm hình', 'Load more artwork')}</Button> : null}
  </section>;
}
