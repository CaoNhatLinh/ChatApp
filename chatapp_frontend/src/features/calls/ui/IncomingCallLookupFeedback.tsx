'use client';

import { X } from 'lucide-react';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import type { IncomingDiscoveryStatus } from '../model/incoming-call-discovery';

interface Props {
  status: IncomingDiscoveryStatus | 'waiting' | 'dismissed';
  retry: () => void;
  loadMore: () => void;
  dismiss: () => void;
}
export function IncomingCallLookupFeedback({ status, retry, loadMore, dismiss }: Props) {
  if (status === 'ready' || status === 'dismissed') return null;
  if (status === 'loading' || status === 'waiting') return <p role="status" className="text-sm leading-6 text-muted-foreground">
    {localizeText(status === 'loading' ? 'Đang kiểm tra cuộc gọi đến…' : 'Đang chờ kết nối để kiểm tra cuộc gọi.')}
  </p>;
  if (status === 'more') return <div>
    <p role="status" className="text-sm leading-6">{localizeText('Chưa kiểm tra hết cuộc gọi đến.')}</p>
    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={loadMore}>{localizeText('Tải tiếp cuộc gọi')}</Button>
  </div>;
  return <div>
    <div className="flex items-start gap-3">
      <p role="alert" className="min-w-0 flex-1 text-base leading-6">{localizeText('Chưa kiểm tra được cuộc gọi đến.')}</p>
      <Button type="button" variant="ghost" size="icon" aria-label={localizeText('Ẩn thông báo lỗi cuộc gọi')} onClick={dismiss}>
        <X aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
    <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>{localizeText('Kiểm tra lại cuộc gọi')}</Button>
  </div>;
}
