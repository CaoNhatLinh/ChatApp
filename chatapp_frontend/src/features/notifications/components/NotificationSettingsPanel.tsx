import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, Check } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/features/notifications/api/notifications.api';
import { localizeText } from '@/shared/i18n';
import { notifyError, notifySuccess } from '@/shared/lib/notification';

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
  { key: 'pushEnabled', label: 'Thông báo đẩy', description: 'Nhận thông báo khi bạn không mở NovaChat.' },
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
      .catch(() => {
        if (active) setError(localizeText('Không thể tải cài đặt thông báo. Vui lòng thử lại sau.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
      setSettings({ ...settings, ...normalizedDraft, quietHoursStart: normalizedDraft.quietHoursStart || null, quietHoursEnd: normalizedDraft.quietHoursEnd || null });
      setDraft(normalizedDraft);
      notifySuccess(localizeText('Đã lưu cài đặt thông báo.'));
    } catch {
      notifyError(localizeText('Không thể lưu cài đặt thông báo. Vui lòng thử lại.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-[var(--radius-md)] border border-border bg-background p-6 text-sm text-muted-foreground" role="status">{localizeText('Đang tải cài đặt thông báo...')}</div>;
  }

  if (error || !settings || !draft) {
    return <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive" role="alert"><AlertCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{error ?? localizeText('Không thể tải cài đặt thông báo.')}</span></div>;
  }

  return (
    <section className="space-y-7" aria-labelledby="notification-settings-title">
      <div>
        <div className="flex items-center gap-3">
          <span className="brand-mark h-10 w-10 rounded-xl text-primary"><Bell size={18} aria-hidden="true" /></span>
          <div>
            <h2 id="notification-settings-title" className="text-2xl font-semibold tracking-tight">{localizeText('Thông báo')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{localizeText('Kiểm soát các kênh và khung giờ bạn muốn nhận thông báo.')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-border bg-background p-4 sm:p-5">
        <p className="text-sm font-semibold">{localizeText('Mức thông báo toàn cục')}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText('Chọn mức độ thông báo chung trước khi tinh chỉnh từng kênh nhận.')}</p>
        <label htmlFor="notification-global-level" className="sr-only">{localizeText('Mức thông báo toàn cục')}</label>
        <select id="notification-global-level" className="mt-3 h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm" value={draft.globalLevel} onChange={(event) => updateDraft('globalLevel', event.target.value as NotificationLevel)}>
          {NOTIFICATION_LEVELS.map((level) => <option key={level.value} value={level.value}>{localizeText(level.label)}</option>)}
        </select>
        <p className="mt-2 text-xs text-muted-foreground">{localizeText(NOTIFICATION_LEVELS.find((level) => level.value === draft.globalLevel)?.description ?? '')}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{localizeText('Kênh thông báo')}</h3>
        {CHANNELS.map(({ key, label, description }) => (
          <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-[var(--radius-md)] border border-border bg-background p-4 transition-colors hover:border-primary/50">
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{localizeText(label)}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{localizeText(description)}</span>
            </span>
            <span className="relative shrink-0">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={draft[key]}
                onChange={(event) => updateDraft(key, event.target.checked)}
              />
              <span className="block h-6 w-11 rounded-full bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-focus-visible:ring-offset-2" aria-hidden="true" />
              <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background text-primary transition-transform peer-checked:translate-x-5">
                {draft[key] ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : null}
              </span>
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-3 rounded-[var(--radius-md)] border border-border bg-background p-4 sm:p-5">
        <div>
          <h3 className="text-sm font-semibold">{localizeText('Giờ yên tĩnh')}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{localizeText('Tạm ngưng thông báo trong khoảng thời gian này. Để trống để tắt giờ yên tĩnh.')}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold"><span>{localizeText('Bắt đầu')}</span><Input type="time" value={draft.quietHoursStart ?? ''} onChange={(event) => updateDraft('quietHoursStart', event.target.value)} /></label>
          <label className="space-y-1.5 text-sm font-semibold"><span>{localizeText('Kết thúc')}</span><Input type="time" value={draft.quietHoursEnd ?? ''} onChange={(event) => updateDraft('quietHoursEnd', event.target.value)} /></label>
        </div>
        <label className="block space-y-1.5 text-sm font-semibold"><span>{localizeText('Múi giờ')}</span><Input value={draft.timezone ?? ''} onChange={(event) => updateDraft('timezone', event.target.value)} placeholder="UTC" /></label>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSave()} loading={saving} disabled={!isDirty}>{localizeText('Lưu thay đổi')}</Button>
      </div>
    </section>
  );
}
