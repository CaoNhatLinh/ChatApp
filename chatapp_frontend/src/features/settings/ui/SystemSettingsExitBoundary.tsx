'use client';

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { ModalShell } from '@/shared/ui/ModalShell';
import { SystemSettingsExitContext } from '../model/system-settings-exit';
import type { SystemSettingsExitState } from '../model/system-settings-exit';

export function SystemSettingsExitBoundary({ children, onExit }: {
  children: (requestExit: () => void) => ReactNode;
  onExit: () => void;
}) {
  const [state, setState] = useState<SystemSettingsExitState>('clear');
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const busy = state === 'busy', uncertain = state === 'uncertain';
  const title = busy ? copy('Đang lưu cài đặt', 'Saving settings')
    : uncertain ? copy('Lần lưu chưa được xác nhận', 'Save not confirmed')
    : copy('Bỏ thay đổi chưa lưu?', 'Discard unsaved changes?');
  const description = busy ? copy('Chờ phản hồi trước khi rời trang.', 'Wait for a response before leaving.')
    : uncertain ? copy('Máy chủ có thể đã lưu. Rời trang không hủy lần lưu; bạn sẽ mất thông tin thử lại.', 'The server may have saved. Leaving does not cancel the save and loses the information needed to retry.')
    : copy('Nháp cài đặt sẽ mất khi bạn rời trang.', 'Your settings draft will be lost if you leave.');

  function requestExit() {
    if (state === 'clear') { onExit(); return; }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }

  return <SystemSettingsExitContext.Provider value={setState}>
    {children(requestExit)}
    <ModalShell open={open} onClose={() => setOpen(false)} title={title} description={description} returnFocusRef={trigger}
      className="inset-auto left-1/2 top-1/2 h-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border sm:max-w-md">
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3 pr-7">
          <CircleAlert size={23} aria-hidden="true" className="shrink-0 text-primary" />
          <div className="space-y-2"><p className="text-lg font-semibold" aria-hidden="true">{title}</p>
            <p className="text-sm leading-6 text-muted-foreground" aria-hidden="true">{description}</p></div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(false)}>{copy('Ở lại', 'Stay')}</Button>
          <Button type="button" className="min-h-11" disabled={busy} onClick={() => { if (!busy) { setOpen(false); onExit(); } }}>{copy('Rời trang', 'Leave page')}</Button>
        </div>
      </div>
    </ModalShell>
  </SystemSettingsExitContext.Provider>;
}
