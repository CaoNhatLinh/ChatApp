import { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { getForwardSource } from '../../api/forward.api';
import type { MessageKey } from '../../api/thread.api';
import { useForwardResource } from '../../model/useForwardResource';
import { ThreadMessage } from '../Thread/ThreadMessage';

export function ForwardSourceDialog({ scope, onClose, onOpenLibrary }: {
  scope: MessageKey; onClose: () => void; onOpenLibrary: (conversationId: string) => void;
}) {
  useAppLocale();
  const source = useForwardResource(scope, getForwardSource, true);
  const blocked = useFriendStore(state => state.blockedUserIds);
  const previous = useRef(blocked);
  const { reload } = source;
  const message = source.value?.source;
  useEffect(() => { if (previous.current !== blocked) { previous.current = blocked; reload(); } }, [blocked, reload]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="forward-source-dialog flex flex-col data-[state=open]:animate-none data-[state=closed]:animate-none sm:max-w-xl"
      onCloseAutoFocus={event => { event.preventDefault(); document.querySelector<HTMLTextAreaElement>('.chat-composer-dock textarea')?.focus(); }}>
      <DialogHeader className="pr-8 text-left"><DialogTitle>{localizeText('Nguồn tin nhắn')}</DialogTitle>
        <DialogDescription>{localizeText('Chỉ hiển thị nguồn bạn có quyền xem.')}</DialogDescription></DialogHeader>
      <Button variant="outline" className="self-start" loading={source.loading} onClick={source.reload}>{localizeText('Tải lại nguồn')}</Button>
      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={source.loading}>
        {source.loading ? <Skeleton className="h-28" /> : null}
        {source.error ? <p role="alert" className="text-sm">{localizeText('Không tải được nguồn. Hãy thử lại.')}</p> : null}
        {message ? <ThreadMessage message={message} onOpenLibrary={() => onOpenLibrary(message.conversationId)} /> : null}
        {source.value && !source.value.available ? <p className="py-6 text-sm text-muted-foreground">{localizeText('Nguồn không còn khả dụng với bạn.')}</p> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
