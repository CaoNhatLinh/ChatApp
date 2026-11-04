import { useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { createForwardCommand, getForwardDraft, sendForward, type ForwardCommand } from '../../api/forward.api';
import { mapToMessage } from '../../api/messenger.api';
import type { MessageKey } from '../../api/thread.api';
import type { Conversation } from '../../types/messenger.types';
import { useForwardResource } from '../../model/useForwardResource';
import { useConversationDirectory } from '../../model/useConversationDirectory';
import { useMessengerStore } from '../../model/messenger.store';
import { ThreadMessage } from '../Thread/ThreadMessage';

export function ForwardMessageDialog({ scope, actorId, onClose, onOpenLibrary }: {
  scope: MessageKey; actorId: string; onClose: () => void; onOpenLibrary: (room: string) => void;
}) {
  useAppLocale();
  const draft = useForwardResource(scope, getForwardDraft);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [discard, setDiscard] = useState(false);
  const command = useRef<ForwardCommand | null>(null);
  const busy = useRef(false);
  const uncertain = useRef(false);
  const leave = useRef(onClose);
  const directory = useConversationDirectory(query, 'ALL', !sent && !command.current);
  const locked = pending || Boolean(command.current) || sent;
  const requestLeave = (next: () => void) => {
    if (busy.current) return;
    if (error && uncertain.current) { leave.current = next; setDiscard(true); } else next();
  };
  const submit = async () => {
    if (busy.current || sent || !selected || !draft.value) return;
    busy.current = true; setPending(true); setError(false);
    const generation = getSessionGeneration();
    const attempt = command.current ?? createForwardCommand(actorId, selected.conversationId, crypto.randomUUID(), draft.value);
    command.current = attempt;
    try {
      const message = await sendForward(attempt);
      if (generation !== getSessionGeneration()) return;
      const mapped = mapToMessage(message), store = useMessengerStore.getState();
      if (!store.conversations.some(room => room.conversationId === attempt.conversationId)) store.hoistConversation(selected);
      store.addMessage(attempt.conversationId, mapped); store.upsertConversationFromMessage(mapped);
      setSent(true); setDeleted(message.isDeleted); uncertain.current = false;
    } catch (failure) {
      if (generation !== getSessionGeneration()) return;
      const status = (failure as { response?: { status?: number } })?.response?.status;
      uncertain.current ||= !status || status >= 500;
      setError(true);
    } finally { busy.current = false; if (generation === getSessionGeneration()) setPending(false); }
  };
  return <>
    <Dialog open onOpenChange={open => { if (!open) requestLeave(onClose); }}>
      <DialogContent showClose={false} className="forward-message-dialog flex flex-col data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-xl"
        onCloseAutoFocus={event => { event.preventDefault(); document.querySelector<HTMLTextAreaElement>('.chat-composer-dock textarea')?.focus(); }}>
        <div className="absolute right-2 top-2"><Button variant="ghost" size="icon" disabled={pending} aria-label={localizeText('Đóng')}
          onClick={() => requestLeave(onClose)}><X size={18} /></Button></div>
        <DialogHeader className="pr-9 text-left"><DialogTitle>{localizeText('Chuyển tiếp tin nhắn')}</DialogTitle>
          <DialogDescription>{localizeText('Chọn nơi nhận rồi xác nhận gửi.')}</DialogDescription></DialogHeader>
        <div className="max-h-36 shrink-0 overflow-y-auto border-b border-border pb-2" aria-busy={draft.loading}>
          {draft.loading ? <Skeleton className="h-20" /> : null}
          {draft.error ? <div role="alert" className="space-y-2 text-sm"><p>{localizeText('Không tải được tin nguồn. Hãy thử lại.')}</p>
            <Button variant="outline" onClick={draft.reload}>{localizeText('Thử lại')}</Button></div> : null}
          {draft.value ? <ThreadMessage message={draft.value.message} onOpenLibrary={() => requestLeave(() => onOpenLibrary(scope.conversationId))} /> : null}
          {draft.value?.attachments.length ? <ul aria-label={localizeText('Tệp đính kèm')} className="space-y-1 pb-2 text-xs text-muted-foreground">
            {draft.value.attachments.map(file => <li key={file.attachmentId} className="break-words">{file.fileName || localizeText('Tệp đính kèm')}</li>)}
          </ul> : null}
        </div>
        {!sent ? <>
          <Input aria-label={localizeText('Tìm nơi nhận')} placeholder={localizeText('Tìm theo tên hoặc tên người dùng')} maxLength={100}
            disabled={locked} value={query} onChange={event => { setQuery(event.target.value); setSelected(null); }} />
          <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={directory.loading}>
            {selected && locked ? <p className="py-3 text-sm font-medium">{selected.name}</p> : directory.content.map(room => <button type="button"
              key={room.conversationId} disabled={locked} aria-pressed={selected?.conversationId === room.conversationId}
              onClick={() => setSelected(room)} className={`focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${selected?.conversationId === room.conversationId ? 'bg-secondary' : 'hover:bg-secondary/60 active:bg-secondary'}`}>
              <span className="min-w-0 break-words">{room.name}</span>{selected?.conversationId === room.conversationId ? <Check size={16} className="shrink-0" /> : null}
            </button>)}
            {directory.loading && !locked ? <Skeleton className="mt-2 h-20" /> : null}
            {directory.error && !locked ? <div role="alert" className="space-y-2 text-sm"><p>{directory.error}</p><Button variant="outline" onClick={() => void directory.retry()}>{localizeText('Thử lại')}</Button></div> : null}
            {!directory.loading && !directory.error && !directory.content.length && !locked ? <p className="py-3 text-sm text-muted-foreground">{localizeText(directory.hasNext ? 'Chưa có kết quả trong phần đã kiểm tra.' : 'Không có cuộc trò chuyện phù hợp.')}</p> : null}
            {directory.hasNext && !directory.error && !locked ? <Button variant="outline" loading={directory.loading} onClick={() => void directory.loadMore()}>{localizeText('Tải thêm cuộc trò chuyện')}</Button> : null}
          </div>
        </> : <p role="status" className="py-4 text-sm">{localizeText(deleted ? 'Tin chuyển tiếp đã bị xóa.' : 'Đã chuyển tiếp.')}</p>}
        {error ? <div role="alert" className="space-y-2 text-sm"><p>{localizeText(uncertain.current ? 'Chưa rõ kết quả. Thử lại dùng cùng lượt gửi.' : 'Không thể chuyển tiếp. Kiểm tra nguồn và quyền gửi rồi thử lại.')}</p>
          {!uncertain.current ? <Button variant="outline" onClick={() => { command.current = null; setError(false); setSelected(null); draft.reload(); }}>{localizeText('Chọn lại nơi nhận')}</Button> : null}</div> : null}
        <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" disabled={pending} onClick={() => requestLeave(onClose)}>{localizeText(sent ? 'Đóng' : 'Hủy')}</Button>
          {!sent ? <Button loading={pending} disabled={!draft.value || !selected || draft.loading} onClick={() => void submit()}>{localizeText(error ? 'Thử gửi lại' : 'Chuyển tiếp')}</Button> : null}
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={discard} onOpenChange={setDiscard} title={localizeText('Đóng lượt gửi chưa rõ kết quả?')}
      description={localizeText('Lượt thử lại chỉ được giữ khi màn hình này còn mở. Đóng rồi gửi lại có thể tạo bản sao.')}
      confirmLabel={localizeText('Đóng màn hình')} onConfirm={() => { setDiscard(false); leave.current(); }} />
  </>;
}
