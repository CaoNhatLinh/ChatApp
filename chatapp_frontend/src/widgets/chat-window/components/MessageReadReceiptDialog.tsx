'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Loader2, RefreshCw } from 'lucide-react';
import type { Message, MessageReadReceipt, MessageReadReceiptPage } from '@/features/messenger/types/messenger.types';
import { Avatar, AvatarFallback, AvatarImage, DefaultUserAvatar } from '@/shared/ui/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { logger } from '@/shared/lib/logger';

interface MessageReadReceiptDialogProps {
  isOpen: boolean;
  message: Message | null;
  onOpenChange: (open: boolean) => void;
  loadPage: (messageId: string, cursor?: string | null) => Promise<MessageReadReceiptPage>;
}

const receiptName = (receipt: MessageReadReceipt): string => (
  receipt.displayName?.trim() || receipt.username?.trim() || localizeText('Thành viên')
);

export const MessageReadReceiptDialog = ({
  isOpen,
  message,
  onOpenChange,
  loadPage,
}: MessageReadReceiptDialogProps) => {
  const { locale } = useAppLocale();
  const [receipts, setReceipts] = useState<MessageReadReceipt[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const messageId = message?.messageId ?? null;

  const loadInitialPage = useCallback(async () => {
    if (!isOpen || !messageId) return;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    setReceipts([]);
    setNextCursor(null);
    setHasNext(false);
    try {
      const page = await loadPage(messageId);
      if (sequence !== requestSequence.current) return;
      setReceipts(page.content);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError: unknown) {
      if (sequence !== requestSequence.current) return;
      logger.error('[MessageReadReceiptDialog] Failed to load seen-by list', loadError instanceof Error ? loadError.message : String(loadError));
      setError(getUserFacingErrorMessage(loadError, localizeText('Không thể tải danh sách người đã xem.')));
    } finally {
      if (sequence === requestSequence.current) setIsLoading(false);
    }
  }, [isOpen, loadPage, messageId]);

  useEffect(() => {
    void loadInitialPage();
  }, [loadInitialPage]);

  const loadMore = async () => {
    if (!messageId || !hasNext || !nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const page = await loadPage(messageId, nextCursor);
      setReceipts((current) => [...current, ...page.content]);
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError: unknown) {
      logger.error('[MessageReadReceiptDialog] Failed to load more viewers', loadError instanceof Error ? loadError.message : String(loadError));
      setError(getUserFacingErrorMessage(loadError, localizeText('Không thể tải thêm người đã xem.')));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0" lang={locale}>
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Eye size={18} aria-hidden="true" className="text-primary" />
            {localizeText('Danh sách người đã xem')}
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            {message?.content || localizeText('Tin nhắn này chưa được xem.')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(60dvh,28rem)] min-h-32 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              {localizeText('Đang tải danh sách người đã xem...')}
            </div>
          ) : error ? (
            <div className="space-y-3 py-6 text-center" role="alert">
              <p className="text-sm text-destructive">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadInitialPage()}>
                <RefreshCw size={14} aria-hidden="true" />
                {localizeText('Thử lại')}
              </Button>
            </div>
          ) : receipts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {localizeText('Tin nhắn này chưa được xem.')}
            </p>
          ) : (
            <ul className="space-y-2" aria-label={localizeText('Danh sách người đã xem')}>
              {receipts.map((receipt) => (
                <li key={receipt.readerId} className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
                  <Avatar className="h-9 w-9 rounded-lg">
                    {receipt.avatarUrl ? <AvatarImage src={receipt.avatarUrl} alt="" /> : null}
                    <AvatarFallback className="rounded-lg bg-accent p-0">
                      <DefaultUserAvatar alt="" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{receiptName(receipt)}</p>
                    {receipt.username && receipt.displayName && receipt.username !== receipt.displayName ? (
                      <p className="truncate text-xs text-muted-foreground">@{receipt.username}</p>
                    ) : null}
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={receipt.readAt}>
                    {new Date(receipt.readAt).toLocaleString(locale === 'en' ? 'en-US' : 'vi-VN')}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasNext && !isLoading && !error ? (
          <div className="border-t border-border/70 px-6 py-3">
            <Button type="button" variant="outline" size="sm" className="w-full" loading={isLoadingMore} onClick={() => void loadMore()}>
              {localizeText('Tải thêm người đã xem')}
            </Button>
          </div>
        ) : null}

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button type="button" onClick={() => onOpenChange(false)}>
            {localizeText('Đóng')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MessageReadReceiptDialog;
