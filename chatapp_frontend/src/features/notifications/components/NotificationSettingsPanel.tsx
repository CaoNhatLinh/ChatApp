import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Bell, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/features/notifications/api/notifications.api';
import { localizeText } from '@/shared/i18n';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { logger } from '@/shared/lib/logger';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';

type NotificationDraft = Pick<
  NotificationSettings,
  'pushEnabled' | 'emailEnabled' | 'desktopEnabled' | 'soundEnabled' | 'quietHoursStart' | 'quietHoursEnd' | 'timezone'
> & { globalLevel: NotificationLevel };

type NotificationLevel = 'ALL' | 'MENTIONS' | 'DIRECT_ONLY' | 'NONE';

const NOTIFICATION_LEVELS: Array<{ value: NotificationLevel; label: string; description: string }> = [
  { value: 'ALL', label: 'Tất cả hoạt động', description: 'Nhận mọi thông báo được phép.' },
  { value: 'MENTIONS', label: 'Chỉ lượt nhắc', description: 'Chỉ nhận thông báo khi có người nhắc bạn.' },
  { value: 'DIRECT_ONLY', label: 'Chỉ tin nhắn trực tiếp', description: 'Chỉ nhận thông báo từ tin nhắn trực tiếp.' },
  { value: 'NONE', label: 'Tắt toàn bộ', description: 'Không nhận thông báo ngoài các cảnh báo an toàn bắt buộc.' },
];

const CHANNELS: Array<{ key: keyof Pick<NotificationDraft, 'pushEnabled' | 'emailEnabled' | 'desktopEnabled' | 'soundEnabled'>; label: string; description: string }> = [
  { key: 'pushEnabled', label: 'Thông báo đẩy', description: 'Nhận thông báo khi bạn không mở Nối.' },
  { key: 'emailEnabled', label: 'Email', description: 'Nhận các thông báo quan trọng qua email.' },
  { key: 'desktopEnabled', label: 'Thông báo trên máy tính', description: 'Hiển thị thông báo trên desktop khi trình duyệt cho phép.' },
  { key: 'soundEnabled', label: 'Âm thanh', description: 'Phát âm thanh cho thông báo mới.' },
];

const isNotificationLevel = (value: string): value is NotificationLevel =>
  NOTIFICATION_LEVELS.some((item) => item.value === value);

const toDraft = (settings: NotificationSettings): NotificationDraft => {
  if (!isNotificationLevel(settings.globalLevel)) {
    throw new Error('Invalid notification level');
  }
  return {
    globalLevel: settings.globalLevel,
    pushEnabled: settings.pushEnabled,
    emailEnabled: settings.emailEnabled,
    desktopEnabled: settings.desktopEnabled,
    soundEnabled: settings.soundEnabled,
    quietHoursStart: settings.quietHoursStart ?? '',
    quietHoursEnd: settings.quietHoursEnd ?? '',
    timezone: settings.timezone ?? '',
  };
};

export function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [draft, setDraft] = useState<NotificationDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const mountedRef = useRef(true);
  const saveRequestRef = useRef(0);

  useEffect(() => () => {
    mountedRef.current = false;
    saveRequestRef.current += 1;
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getNotificationSettings()
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setDraft(toDraft(result));
      })
      .catch((loadError: unknown) => {
        if (active) {
          logger.warn('Notification settings load failed', loadError instanceof Error ? loadError.message : String(loadError));
          setError(getUserFacingErrorMessage(loadError, localizeText('Không thể tải cài đặt thông báo. Vui lòng thử lại sau.')));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryToken]);

  const isDirty = useMemo(() => {
    if (!settings || !draft) return false;
    const saved = toDraft(settings);
    return JSON.stringify(saved) !== JSON.stringify(draft);
  }, [draft, settings]);

  const updateDraft = <K extends keyof NotificationDraft>(key: K, value: NotificationDraft[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const handleSave = async () => {
    if (!settings || !draft || !isDirty) return;
    const requestId = ++saveRequestRef.current;
    setSaving(true);
    try {
      const normalizedDraft: NotificationDraft = {
        ...draft,
        quietHoursStart: draft.quietHoursStart?.trim() || '',
        quietHoursEnd: draft.quietHoursEnd?.trim() || '',
        timezone: draft.timezone?.trim() || 'UTC',
      };
      await updateNotificationSettings({
        ...normalizedDraft,
        quietHoursStart: normalizedDraft.quietHoursStart || null,
        quietHoursEnd: normalizedDraft.quietHoursEnd || null,
      });
      if (!mountedRef.current || requestId !== saveRequestRef.current) return;
      setSettings({ ...settings, ...normalizedDraft, quietHoursStart: normalizedDraft.quietHoursStart || null, quietHoursEnd: normalizedDraft.quietHoursEnd || null });
      setDraft(normalizedDraft);
      notifySuccess(localizeText('Đã lưu cài đặt thông báo.'));
    } catch (saveError: unknown) {
      if (!mountedRef.current || requestId !== saveRequestRef.current) return;
      logger.warn('Notification settings save failed', saveError instanceof Error ? saveError.message : String(saveError));
      notifyError(localizeText('Không thể lưu cài đặt thông báo. Vui lòng thử lại.'));
    } finally {
      if (mountedRef.current && requestId === saveRequestRef.current) setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-[var(--radius-md)] border border-border bg-background p-6 text-sm text-muted-foreground" role="status">{localizeText('Đang tải cài đặt thông báo...')}</div>;
  }

  if (error || !settings || !draft) {
    return <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert"><div className="flex min-w-0 items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error ?? localizeText('Không thể tải cài đặt thông báo.')}</span></div><Button type="button" size="sm" variant="outline" onClick={() => setRetryToken((current) => current + 1)}>{localizeText('Thử lại')}</Button></div>;
  }

  return (
    <section className="space-y-8" aria-labelledby="notification-settings-title">
      <header className="border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-primary"><Bell size={17} aria-hidden="true" /></span>
          <div>
            <h2 id="notification-settings-title" className="text-2xl font-semibold tracking-[-0.035em]">{localizeText('Thông báo')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{localizeText('Chọn điều gì đáng để làm gián đoạn bạn.')}</p>
          </div>
        </div>
      </header>

      <fieldset>
        <legend className="text-sm font-semibold">{localizeText('Mức thông báo toàn cục')}</legend>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{localizeText('Mức này áp dụng trước khi Nối xét đến từng kênh nhận.')}</p>
        <div className="mt-4 grid gap-2">
          {NOTIFICATION_LEVELS.map((level) => (
            <label key={level.value} className="group flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-transparent px-3 py-2.5 transition-colors hover:bg-muted/55 has-[:checked]:border-primary/45 has-[:checked]:bg-primary/7">
              <input className="focus-ring mt-1 h-4 w-4 accent-[var(--primary)]" type="radio" name="notification-global-level" value={level.value} checked={draft.globalLevel === level.value} onChange={() => updateDraft('globalLevel', level.value)} />
              <span>
                <span className="block text-sm font-semibold">{localizeText(level.label)}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{localizeText(level.description)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold">{localizeText('Kênh nhận')}</legend>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{localizeText('Bật những cách Nối có thể liên hệ với bạn.')}</p>
        <div className="mt-4 divide-y divide-border border-y border-border">
          {CHANNELS.map(({ key, label, description }) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4 py-4">
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{localizeText(label)}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{localizeText(description)}</span>
              </span>
              <span className="relative shrink-0">
                <input type="checkbox" className="peer sr-only" checked={draft[key]} onChange={(event) => updateDraft(key, event.target.checked)} />
                <span className="block h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2" aria-hidden="true" />
                <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-primary transition-transform peer-checked:translate-x-5">{draft[key] ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <details className="group border-y border-border py-4">
        <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-[var(--radius-sm)] text-sm font-semibold marker:hidden">
          <span>{localizeText('Giờ yên tĩnh')}</span><ChevronDown size={17} aria-hidden="true" className="transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{localizeText('Tạm ngưng thông báo theo giờ địa phương. Để trống để không đặt giờ yên tĩnh.')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold"><span>{localizeText('Bắt đầu')}</span><Input type="time" value={draft.quietHoursStart ?? ''} onChange={(event) => updateDraft('quietHoursStart', event.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-semibold"><span>{localizeText('Kết thúc')}</span><Input type="time" value={draft.quietHoursEnd ?? ''} onChange={(event) => updateDraft('quietHoursEnd', event.target.value)} /></label>
        </div>
        <label className="mt-3 block space-y-1.5 text-sm font-semibold"><span>{localizeText('Múi giờ')}</span><Input value={draft.timezone ?? ''} onChange={(event) => updateDraft('timezone', event.target.value)} placeholder="UTC" /></label>
      </details>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <p className="text-xs text-muted-foreground">{isDirty ? localizeText('Bạn có thay đổi chưa lưu.') : localizeText('Mọi thay đổi đã được lưu.')}</p>
        <Button type="button" onClick={() => void handleSave()} loading={saving} disabled={!isDirty}>{localizeText('Lưu thay đổi')}</Button>
      </div>
    </section>
  );
}
