import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Skeleton } from '@/shared/ui/Skeleton';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import type { RoomVisualComputed } from '@/features/settings/constants/chat-theme.constants';
import { useMessageThread } from '../../model/useMessageThread';
import type { MessageKey } from '../../api/thread.api';
import { mapToMessage } from '../../api/messenger.api';
import type { Message } from '../../types/messenger.types';
import { ThreadMessage } from './ThreadMessage';
import { ThreadReplyComposer } from './ThreadReplyComposer';

export function MessageThreadDialog({ scope, roomVisual, onClose, onComposeMain, onOpenLibrary }: {
  scope: MessageKey; roomVisual: RoomVisualComputed; onClose: () => void;
  onComposeMain: (parent: Message) => void; onOpenLibrary: () => void;
}) {
  useAppLocale();
  const thread = useMessageThread(scope);
  const blocked = useFriendStore(state => state.blockedUserIds);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [discard, setDiscard] = useState(false);
  const leave = useRef(onClose);
  const previousBlocked = useRef(blocked);
  const { reload } = thread;
  useEffect(() => { if (previousBlocked.current !== blocked) { previousBlocked.current = blocked; reload(); } }, [blocked, reload]);
  const requestLeave = (next: () => void) => { if (pending) return; if (draft.trim()) { leave.current = next; setDiscard(true); } else next(); };
  const requestClose = () => requestLeave(onClose);
  const background = roomVisual.backgroundImage;
  const style = { backgroundImage: background ? `${roomVisual.backgroundOverlay}, url("${background}")` : roomVisual.backgroundOverlay,
    backgroundSize: background ? 'cover' : undefined, backgroundPosition: 'center',
    '--room-signal': roomVisual.signalColor, '--room-signal-foreground': roomVisual.signalForeground } as CSSProperties;

  return <>
    <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent className="thread-dialog messenger-workspace flex h-dvh max-h-dvh flex-col gap-0 p-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh sm:w-full sm:max-w-xl sm:translate-x-0 sm:translate-y-0 sm:rounded-none"
        onCloseAutoFocus={event => { event.preventDefault(); document.querySelector<HTMLTextAreaElement>('.chat-composer-dock textarea')?.focus(); }}>
        <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>{localizeText('Trả lời tin nhắn')}</DialogTitle>
          <DialogDescription>{localizeText('Các trả lời cho tin nhắn này.')}</DialogDescription>
        </DialogHeader>
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <p className="text-xs text-muted-foreground">{localizeText('Cũ trước, mới sau')}</p>
          <Button size="sm" variant="outline" loading={thread.loading} onClick={thread.reload}>{localizeText('Tải lại trả lời')}</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 sm:px-3" data-room-mode={roomVisual.preset.mode} style={style} aria-busy={thread.loading}>
          <div className="thread-reading-plane min-h-full bg-background px-2 pb-4 text-foreground sm:px-3">
          {thread.updates ? <Button variant="secondary" size="sm" onClick={thread.reload}>{localizeText('Có cập nhật · Tải lại')}</Button> : null}
          {thread.loading && !thread.page ? <div role="status" aria-label={localizeText('Đang tải trả lời…')} className="space-y-4 py-4"><Skeleton className="h-24 w-4/5" /><Skeleton className="ml-auto h-16 w-3/4" /></div> : null}
          {thread.page ? <>
            <h3 className="pt-3 text-sm font-semibold">{localizeText('Tin gốc')}</h3>
            <ThreadMessage message={thread.page.parent} bubbleStyle={roomVisual.messageBubbleStyle} onOpenLibrary={() => requestLeave(onOpenLibrary)} />
            <h3 className="mt-4 border-t border-border pt-4 text-sm font-semibold">{localizeText('Trả lời')}</h3>
            <div className="divide-y divide-border/50">{thread.page.content.map(message => <ThreadMessage key={message.messageId} message={message} bubbleStyle={roomVisual.messageBubbleStyle} onOpenLibrary={() => requestLeave(onOpenLibrary)} />)}</div>
            {!thread.page.content.length && !thread.loading && !thread.error ? <p className="py-5 text-sm text-muted-foreground">{localizeText(thread.page.hasNext ? 'Phần này chưa có trả lời hiển thị. Bạn có thể tải tiếp.' : 'Chưa có trả lời. Bạn có thể bắt đầu bên dưới.')}</p> : null}
            {thread.page.parent.isDeleted ? <p className="py-2 text-sm text-muted-foreground">{localizeText('Tin gốc đã bị xóa. Bạn vẫn xem được các trả lời còn lại.')}</p> : null}
          </> : null}
          {thread.error ? <div role="alert" className="space-y-3 py-4 text-sm">
            <p>{localizeText(thread.error === 'forbidden' ? 'Bạn không còn quyền xem cuộc trò chuyện này.' : thread.error === 'missing' ? 'Tin gốc không còn khả dụng.' : 'Không tải được trả lời. Hãy thử lại.')}</p>
            <Button variant="outline" disabled={thread.loading} onClick={thread.retry}>{localizeText('Thử lại')}</Button>
          </div> : null}
          {thread.page?.hasNext && !thread.error ? <Button className="mt-4" variant="outline" loading={thread.loading} onClick={thread.loadMore}>{localizeText('Tải thêm trả lời')}</Button> : null}
          </div>
        </div>
        <ThreadReplyComposer parent={thread.page?.parent} disabled={!thread.page || Boolean(thread.page.parent.isDeleted) || thread.loading}
          text={draft} onTextChange={setDraft} onPendingChange={setPending} onSubmitted={thread.reload}
          onComposeMain={parent => onComposeMain(mapToMessage(parent))} />
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={discard} onOpenChange={setDiscard} title={localizeText('Bỏ bản nháp trả lời?')}
      description={localizeText('Nội dung bạn đang viết chưa được gửi.')} confirmLabel={localizeText('Bỏ bản nháp')}
      onConfirm={() => { setDraft(''); setDiscard(false); leave.current(); }} />
  </>;
}
