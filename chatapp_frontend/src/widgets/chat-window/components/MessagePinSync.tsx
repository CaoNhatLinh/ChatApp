import { useMessagePinSync } from '@/features/messenger/model/useMessagePinSync';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

export function MessagePinSync({ conversationId }: { conversationId: string }) {
  const { status, retry } = useMessagePinSync(conversationId);
  if (status === 'ready') return null;

  return (
    <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-4 py-2 text-xs text-foreground">
      <span>{localizeText(status === 'error'
        ? 'Chưa đồng bộ được tin nhắn ghim.'
        : 'Đang đồng bộ tin nhắn ghim…')}</span>
      <Button type="button" size="sm" variant="ghost" loading={status === 'loading'} onClick={retry}>
        {localizeText('Thử lại')}
      </Button>
    </div>
  );
}
