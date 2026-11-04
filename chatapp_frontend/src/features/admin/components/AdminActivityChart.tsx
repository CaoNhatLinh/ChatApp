import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { AdminAnalyticsPoint } from '../api/admin.api';
import { summarizeAdminActivity } from '../model/activity-summary';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';

export function AdminActivityChart({ points, labelForType }: { points: AdminAnalyticsPoint[]; labelForType: (type: string) => string }) {
  const [selectedDay, setSelectedDay] = useState<string>();
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const day = points.some(point => point.eventDay === selectedDay) ? selectedDay : undefined;
  const summary = summarizeAdminActivity(points, day);
  const maximum = Math.max(1, ...summary.days.map(([, count]) => count));
  const dateLabel = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return <figure className="admin-activity-chart" aria-label={copy('Sự kiện đã tải theo ngày', 'Loaded events by day')}>
    <figcaption className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span>{day ? dateLabel(day) : copy('Trong khoảng đã chọn', 'Selected date range')} · <strong className="tabular-nums">{summary.count}</strong> {copy('sự kiện', summary.count === 1 ? 'event' : 'events')}</span>
      {day ? <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedDay(undefined)}>{copy('Tất cả ngày', 'All days')}</Button> : null}
    </figcaption>
    <p className="mt-5 text-xs text-muted-foreground">{copy('Chọn ngày để xem', 'Choose a day to inspect')}</p>
    <div className="admin-activity-days" role="group" aria-label={copy('Chọn ngày để xem chi tiết', 'Choose a day to see details')}>
      {summary.days.map(([value, count]) => <button key={value} type="button" aria-pressed={day === value}
        aria-label={`${dateLabel(value)}: ${count} ${copy('sự kiện', count === 1 ? 'event' : 'events')}`}
        onClick={() => setSelectedDay(current => current === value ? undefined : value)} style={{ '--activity-height': `${count / maximum * 100}%` } as CSSProperties}>
        <span className="admin-activity-bar" aria-hidden="true"><span /><b>{count}</b></span>
        <span className="mt-2 text-xs text-muted-foreground">{value.slice(8)}</span>
      </button>)}
    </div>
    <dl className="mt-6 space-y-4" aria-live="polite">
      {summary.types.map(([type, count]) => <div key={type}>
        <div className="mb-2 flex justify-between gap-3 text-sm"><dt>{labelForType(type)}</dt><dd className="tabular-nums">{count}</dd></div>
        <div className="admin-activity-track" aria-hidden="true"><span style={{ width: `${count / Math.max(1, summary.count) * 100}%` }} /></div>
      </div>)}
    </dl>
    <p className="mt-5 text-xs text-muted-foreground">{copy('Chỉ tính sự kiện đã tải, không phải tổng toàn hệ thống.', 'Counts loaded events, not system-wide totals.')}</p>
  </figure>;
}
