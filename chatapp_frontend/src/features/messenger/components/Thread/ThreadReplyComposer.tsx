import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMessenger } from '../../model/useMessenger';
import type { BackendMessage } from '../../api/messenger.api';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Textarea } from '@/shared/ui/Textarea';
import { MAX_MESSAGE_CONTENT_LENGTH } from '../../constants/messageLimits';

export function ThreadReplyComposer({ parent, disabled, text, onTextChange, onPendingChange, onSubmitted, onComposeMain }: {
  parent?: BackendMessage; disabled: boolean; text: string; onTextChange: (text: string) => void;
  onPendingChange: (pending: boolean) => void; onSubmitted: () => void; onComposeMain: (parent: BackendMessage) => void;
}) {
  const { sendMessage, activeConversationId } = useMessenger();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [sent, setSent] = useState(false);
  const busy = useRef(false);
  const alive = useRef(true);
  const attempt = useRef<{ clientMessageId: string; content: string } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy.current || disabled || !parent || parent.isDeleted || activeConversationId !== parent.conversationId || !text.trim()) return;
    busy.current = true; setPending(true); onPendingChange(true); setSent(false);
    const generation = getSessionGeneration();
    const command = attempt.current ?? { clientMessageId: crypto.randomUUID(), content: text.trim() };
    attempt.current = command;
    try {
      await sendMessage(command.content, 'TEXT', { clientMessageId: command.clientMessageId,
        replyToId: parent.messageId, replyToMessageBucket: parent.messageBucket });
      if (!alive.current || generation !== getSessionGeneration()) return;
      attempt.current = null; setError(false); setSent(true); onTextChange(''); onSubmitted();
    } catch {
      if (alive.current && generation === getSessionGeneration()) setError(true);
    } finally {
      busy.current = false;
      if (alive.current) { setPending(false); onPendingChange(false); }
    }
  };

  return <form onSubmit={event => void submit(event)} className="space-y-3 border-t border-border bg-background px-4 py-3 sm:px-6">
    <label htmlFor="thread-reply-text" className="block text-sm font-medium">{localizeText('Nội dung trả lời')}</label>
    <Textarea id="thread-reply-text" value={text} maxLength={MAX_MESSAGE_CONTENT_LENGTH} disabled={disabled || pending || error}
      onChange={event => { onTextChange(event.target.value); setSent(false); }} rows={2}
      aria-describedby={error ? 'thread-send-error' : undefined} />
    {error ? <p id="thread-send-error" role="alert" className="text-sm text-destructive">{localizeText('Chưa xác nhận được trả lời. Thử lại sẽ dùng cùng mã gửi.')}</p> : null}
    {sent ? <p role="status" className="text-sm text-muted-foreground">{localizeText('Đã gửi trả lời.')}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" size="sm" variant="ghost" disabled={disabled || pending || Boolean(text.trim()) || !parent}
        onClick={() => { if (parent) onComposeMain(parent); }}>{localizeText('Dùng ô soạn chính')}</Button>
      <Button type="submit" loading={pending} disabled={disabled || !text.trim()}>{localizeText(error ? 'Thử gửi lại' : 'Gửi trả lời')}</Button>
    </div>
  </form>;
}
