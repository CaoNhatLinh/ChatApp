'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, ImageOff, Plus, RefreshCcw } from 'lucide-react';
import { Button } from '@/shared/ui';
import { useAppLocale } from '@/shared/i18n';
import { listAdminStickerPacks } from '../api/stickers.api';
import type { StickerPack } from '../api/stickers.api';
import type { StickerCopy } from './StickerArtworkUpload';
import { StickerPackEditor } from './StickerPackEditor';
import { StickerInventory } from './StickerInventory';
import { StickerShelfArt } from './StickerShelfArt';
import styles from './StickerAdminPanel.module.css';

export function StickerAdminPanel() {
  const { locale } = useAppLocale();
  const copy: StickerCopy = (vi, en) => locale === 'vi' ? vi : en;
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editor, setEditor] = useState<{ id: string; pack?: StickerPack }>();
  const [editorVisible, setEditorVisible] = useState(false);
  const editorTitle = useRef<HTMLHeadingElement | null>(null);
  const catalogTitle = useRef<HTMLHeadingElement | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (editorVisible) editorTitle.current?.focus(); }, [editorVisible, editor?.id]);
  const [packBusy, setPackBusy] = useState(false);
  const [itemBusy, setItemBusy] = useState(false);
  const busy = packBusy || itemBusy;
  const request = useRef<AbortController | null>(null);
  const retryCursor = useRef<string | undefined>(undefined);
  const load = useCallback(async (after?: string) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    retryCursor.current = after; setLoading(true); setError(false);
    try {
      const page = await listAdminStickerPacks(after, controller.signal);
      if (controller.signal.aborted) return;
      setPacks(current => after ? [...current, ...page.content.filter(pack => !current.some(item => item.stickerPackId === pack.stickerPackId))] : page.content);
      setCursor(page.nextCursor);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  function saved(pack: StickerPack) {
    setEditor(current => current?.id === pack.stickerPackId ? { ...current, pack } : current);
    setPacks(current => current.some(item => item.stickerPackId === pack.stickerPackId) ? current.map(item => item.stickerPackId === pack.stickerPackId ? pack : item) : [...current, pack]);
  }
  function openEditor(next: { id: string; pack?: StickerPack }, trigger: HTMLButtonElement) {
    editTrigger.current = trigger; setEditor(next); setEditorVisible(true);
  }
  function showCatalog() {
    setEditorVisible(false);
    requestAnimationFrame(() => {
      if (editTrigger.current?.isConnected) editTrigger.current.focus(); else catalogTitle.current?.focus();
    });
  }
  return <section aria-labelledby="sticker-catalog-title" data-editing={Boolean(editor && editorVisible)} className="admin-sticker-panel space-y-6">
    <header className="flex justify-end">
      <h2 ref={catalogTitle} tabIndex={-1} id="sticker-catalog-title" className="sr-only">{copy('Bộ sticker', 'Sticker packs')}</h2>
      <div className="admin-sticker-catalog-actions flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="icon" loading={loading} disabled={busy}
          aria-label={copy('Làm mới', 'Refresh')} title={copy('Làm mới', 'Refresh')} onClick={() => void load()}>
          {!loading && <RefreshCcw size={16} aria-hidden="true" />}
        </Button>
        <Button type="button" disabled={busy} onClick={event => openEditor({ id: crypto.randomUUID() }, event.currentTarget)}>
          <Plus size={16} aria-hidden="true" />{copy('Tạo bộ sticker', 'Create sticker pack')}
        </Button>
      </div>
    </header>
    <div className={`admin-sticker-workbench ${styles.workbench}`}>
      <div className="admin-sticker-catalog min-w-0 space-y-3">
        {error ? <div role="alert" className="space-y-2 text-sm text-destructive"><p>{copy('Không tải được danh sách. Thử lại để tiếp tục.', 'Could not load the catalog. Retry to continue.')}</p><Button variant="outline" onClick={() => void load(retryCursor.current)}>{copy('Thử lại', 'Retry')}</Button></div> : null}
        {loading ? <p role="status" className="text-sm text-muted-foreground">{copy('Đang tải bộ sticker…', 'Loading sticker packs…')}</p> : null}
        {!loading && !error && packs.length === 0 ? <div className="admin-sticker-unselected">
          <StickerShelfArt />
          <p>{copy('Chưa có bộ sticker nào.', 'No sticker packs yet.')}</p>
        </div> : null}
        <ul className={`admin-sticker-shelf ${styles.shelf}`}>
          {packs.map(pack => (
            <li key={pack.stickerPackId} className="min-w-0">
              <button type="button" disabled={busy} aria-pressed={editorVisible && editor?.id === pack.stickerPackId}
                onClick={event => openEditor({ id: pack.stickerPackId, pack }, event.currentTarget)}
                className={`admin-sticker-pack ${styles.pack}`}>
                <span className={`admin-sticker-cover ${styles.cover}`}>
                  <PackCover key={pack.cover?.url} pack={pack} copy={copy} />
                </span>
                <span className={styles.packCaption}>
                  <span className="min-w-0">
                    <strong className="block break-words text-sm font-semibold">{pack.name}</strong>
                    <span className="admin-sticker-state">
                      {pack.isActive && <span className="admin-sticker-published shrink-0" aria-hidden="true" />}
                      {pack.isActive ? copy('Đã công bố', 'Published') : copy('Chưa công bố', 'Unpublished')}
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className={styles.openIcon} />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {cursor ? <Button variant="outline" loading={loading} disabled={busy} onClick={() => void load(cursor)}>{copy('Xem thêm', 'Load more')}</Button> : null}
      </div>
      <div className={`admin-sticker-editor min-w-0 space-y-6 ${styles.editor}`}>
        {editor ? <>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={showCatalog}><ArrowLeft size={16} aria-hidden="true" />{copy('Danh sách bộ sticker', 'Sticker pack list')}</Button>
          <StickerPackEditor key={`${editor.id}:metadata`} packId={editor.id} pack={editor.pack}
            copy={copy} blocked={itemBusy} onBusy={setPackBusy} onSaved={saved} titleRef={editorTitle} />
          {editor.pack ? <StickerInventory key={`${editor.id}:artwork`} pack={editor.pack}
            copy={copy} blocked={packBusy} onBusy={setItemBusy} onSaved={saved} /> : null}
        </> : null}
      </div>
    </div>
  </section>;
}

function PackCover({ pack, copy }: { pack: StickerPack; copy: StickerCopy }) {
  const [failed, setFailed] = useState(false);
  if (!pack.cover || failed) return <ImageOff size={32} strokeWidth={1.5} className="text-muted-foreground" aria-label={copy('Chưa có ảnh bìa', 'No cover image')} />;
  return <img src={pack.cover.url} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}
