import { useEffect, useId, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { useConversationDirectory } from '@/features/messenger/model/useConversationDirectory';
import { useMessenger } from '@/features/messenger/model/useMessenger';
import type { Conversation } from '@/features/messenger/types/messenger.types';

export const ConversationQuickOpen = () => {
  useAppLocale();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const listId = useId();
  const directory = useConversationDirectory(query, 'ALL', open);
  const { selectConversation, hoistConversation } = useMessenger();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      if (!open && document.querySelector('[role="dialog"][data-state="open"]')) return;
      event.preventDefault();
      if (!open) { setQuery(''); setActive(0); setSelectionError(false); }
      setOpen(previous => !previous);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const choose = async (conversation: Conversation) => {
    if (selecting) return;
    setSelecting(true);
    setSelectionError(false);
    try {
      hoistConversation(conversation);
      await selectConversation(conversation.conversationId);
      setOpen(false);
    } catch {
      setSelectionError(true);
    } finally { setSelecting(false); }
  };

  const show = (next: boolean) => {
    setOpen(next);
    if (next) { setQuery(''); setActive(0); setSelectionError(false); }
  };

  return <>
    <Button type="button" variant="ghost" size="icon" title={`${localizeText('Mở nhanh hội thoại')} (Ctrl/Cmd+K)`}
      aria-label={localizeText('Mở nhanh hội thoại')} onClick={() => show(true)}><Search size={18} /></Button>
    <Dialog open={open} onOpenChange={show}>
      <DialogContent className="flex flex-col sm:max-w-xl">
        <DialogHeader><DialogTitle>{localizeText('Mở nhanh hội thoại')}</DialogTitle>
          <DialogDescription>{localizeText('Tìm trong các cuộc trò chuyện bạn tham gia.')}</DialogDescription></DialogHeader>
        <Input value={query} maxLength={100} autoComplete="off" role="combobox" aria-expanded="true"
          aria-label={localizeText('Tìm theo tên hoặc tên người dùng')} aria-controls={listId}
          aria-activedescendant={directory.content[active] ? `${listId}-${active}` : undefined}
          placeholder={localizeText('Tìm theo tên hoặc tên người dùng')}
          onChange={event => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(index => Math.max(0, Math.min(directory.content.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))));
            }
            if (event.key === 'Enter' && directory.content[active]) { event.preventDefault(); void choose(directory.content[active]); }
          }} />
        {directory.error ? <div role="alert" className="space-y-2 text-sm"><p>{directory.error}</p><Button variant="outline" onClick={() => void directory.retry()}>{localizeText('Thử lại')}</Button></div> : null}
        {selectionError ? <p role="alert" className="text-sm text-destructive">{localizeText('Không tải được cuộc trò chuyện. Hãy thử lại.')}</p> : null}
        <div id={listId} role="listbox" aria-label={localizeText('Cuộc trò chuyện')} aria-busy={directory.loading || selecting} className="min-h-0 max-h-[50dvh] space-y-1 overflow-y-auto">
          {directory.content.map((conversation, index) => <button key={conversation.conversationId} id={`${listId}-${index}`} role="option"
            aria-selected={index === active} disabled={selecting} type="button" onClick={() => void choose(conversation)}
            className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${index === active ? 'bg-secondary' : 'hover:bg-secondary/60'}`}>
            <span className="truncate font-medium">{conversation.name}</span>
            {conversation.unreadCount > 0 ? <span className="shrink-0 text-xs">{conversation.unreadCount} {localizeText('tin nhắn chưa đọc')}</span> : null}
          </button>)}
        </div>
        {directory.loading ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang tải...')}</p> : null}
        {!directory.loading && !directory.error && directory.content.length === 0 ? <p className="text-sm text-muted-foreground">{localizeText(directory.hasNext ? 'Chưa có kết quả trong phần đã kiểm tra.' : 'Không có cuộc trò chuyện phù hợp.')}</p> : null}
        {directory.hasNext && !directory.error ? <Button variant="outline" disabled={directory.loading} onClick={() => void directory.loadMore()}>{localizeText('Tải thêm cuộc trò chuyện')}</Button> : null}
      </DialogContent>
    </Dialog>
  </>;
};
