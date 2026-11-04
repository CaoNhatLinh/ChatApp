'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Badge } from '@/shared/ui/Badge';
import { Skeleton } from '@/shared/ui/Skeleton';
import { listOwnJoinRequests, type OwnJoinRequest, type OwnJoinRequestPage } from '../api/join-requests.api';

const STATUS_COPY: Record<OwnJoinRequest['status'], string> = {
  PENDING: 'Đang chờ duyệt', APPROVING: 'Quản lý đang xử lý', APPROVED: 'Đã được duyệt',
  DECLINED: 'Yêu cầu bị từ chối', CANCELLED: 'Yêu cầu đã hủy', FAILED: 'Không thể hoàn tất yêu cầu',
  RETRY_REQUIRED: 'Chưa xác nhận được trạng thái',
};

function RequestList() {
  const { locale } = useAppLocale();
  const [page, setPage] = useState<OwnJoinRequestPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);

  const load = useCallback(async (cursor?: string) => {
    activeRequest.current?.abort();
    const request = new AbortController();
    activeRequest.current = request;
    setLoading(true);
    setError(false);
    try {
      const result = await listOwnJoinRequests(cursor, request.signal);
      if (request.signal.aborted) return;
      setPage((previous) => ({ ...result, content: cursor && previous
        ? [...previous.content, ...result.content.filter((item) => !previous.content.some((existing) => existing.requestId === item.requestId))]
        : result.content }));
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return () => activeRequest.current?.abort();
  }, [load]);

  return (
    <div className="mt-4 space-y-4" aria-busy={loading}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{localizeText('Xem kết quả những yêu cầu bạn đã gửi qua lời mời hoặc trang cộng đồng.')}</p>
        <Button size="sm" variant="outline" loading={loading} onClick={() => void load()}>
          <RefreshCw size={14} aria-hidden="true" />{localizeText('Làm mới')}
        </Button>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{localizeText('Không thể tải yêu cầu tham gia. Thử làm mới để tải lại.')}</p> : null}
      {!page && loading ? <Skeleton className="h-24" aria-label={localizeText('Đang tải yêu cầu tham gia...')} /> : null}
      {page?.content.length === 0 && !error && !loading ? <p role="status" className="py-4 text-sm text-muted-foreground">{localizeText('Bạn chưa gửi yêu cầu nào. Chọn một cộng đồng bên dưới để bắt đầu.')}</p> : null}
      {page && page.content.length > 0 ? <ul className="divide-y divide-border">
        {page.content.map((request) => <li key={request.requestId} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium">{localizeText(request.linkId ? 'Qua lời mời' : 'Qua trang cộng đồng')}</p>
            <p className="text-xs text-muted-foreground"><time dateTime={request.requestedOn}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(request.requestedOn))}</time></p>
            <p className="break-all text-xs text-muted-foreground">{localizeText('Mã phòng')}: {request.conversationId}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">{localizeText(STATUS_COPY[request.status])}</Badge>
            {request.status === 'APPROVED' ? <Button asChild size="sm" variant="outline"><Link href={`/app?conversationId=${encodeURIComponent(request.conversationId)}`}>{localizeText('Mở phòng')}</Link></Button> : null}
          </div>
        </li>)}
      </ul> : null}
      {page?.hasNext && page.nextCursor ? <Button variant="outline" size="sm" loading={loading} onClick={() => void load(page.nextCursor ?? undefined)}>{localizeText('Xem thêm yêu cầu')}</Button> : null}
    </div>
  );
}

export function OwnJoinRequests({ revision }: { revision: number }) {
  const { locale } = useAppLocale();
  const userId = useAuthStore((state) => state.user?.userId);
  const [open, setOpen] = useState(false);
  return (
    <details className="mt-6 border-b border-border py-4" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-3 rounded-[var(--radius-sm)] font-semibold marker:hidden">
        {localizeText('Yêu cầu tham gia của bạn')}<ChevronDown size={18} aria-hidden="true" className={open ? 'rotate-180' : ''} />
      </summary>
      {open && userId ? <RequestList key={`${userId}:${locale}:${revision}`} /> : null}
    </details>
  );
}
