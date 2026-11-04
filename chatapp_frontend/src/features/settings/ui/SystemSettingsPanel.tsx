'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { Info, RefreshCcw } from 'lucide-react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { listSystemSettings } from '../api/system-settings.api';
import type { SystemSetting, SystemSettingKey } from '../api/system-settings.api';
import { SystemSettingEditor } from './SystemSettingEditor';
import { CommunitySettingsPreview } from './CommunitySettingsPreview';
import { combineSettingsExitStates, useSystemSettingsExitState } from '../model/system-settings-exit';
import type { SystemSettingsExitState } from '../model/system-settings-exit';

export function SystemSettingsPanel({ supplementaryTools }: { supplementaryTools?: ReactNode }) {
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
  const [pending, setPending] = useState<Map<SystemSettingKey, SystemSettingsExitState>>(() => new Map());
  const [editing, setEditing] = useState<SystemSettingKey | null>(null);
  const editTrigger = useRef<HTMLButtonElement | null>(null);
  const editSetting = (key: SystemSettingKey, trigger: HTMLButtonElement) => {
    editTrigger.current = trigger;
    setEditing(key);
  };
  useSystemSettingsExitState(combineSettingsExitStates(pending.values()));
  const request = useRef<AbortController | null>(null);
  const onCurrent = useCallback((current: SystemSetting) => {
    setSettings(items => items.map(item => item.key === current.key ? current : item));
  }, []);
  const onDraftState = useCallback((key: SystemSettingKey, state: SystemSettingsExitState) => {
    setPending(keys => {
      if ((keys.get(key) ?? 'clear') === state) return keys;
      const next = new Map(keys);
      if (state !== 'clear') next.set(key, state); else next.delete(key);
      return next;
    });
  }, []);
  const onDenied = useCallback(() => {
    request.current?.abort(); setEditing(null); editTrigger.current = null;
    setSettings([]); setState('forbidden');
  }, []);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setEditing(null); editTrigger.current = null; setState('loading'); setSettings([]);
    try {
      const response = await listSystemSettings(controller.signal);
      if (controller.signal.aborted) return;
      setSettings(response); setState('ready');
    } catch (error) {
      if (controller.signal.aborted) return;
      setState(axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0) ? 'forbidden' : 'error');
    }
  }, []);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  const access = settings.find(setting => setting.key === 'community.creationEnabled');
  const editors = settings.map(setting => <SystemSettingEditor key={setting.key} setting={setting} onDenied={onDenied} onCurrent={onCurrent} onDraftState={onDraftState}
    open={editing === setting.key} onEdit={trigger => editSetting(setting.key, trigger)} onClose={() => setEditing(null)} returnFocusRef={editTrigger} />);
  return <section aria-labelledby="system-settings-title" className="min-w-0 space-y-4">
    <header className="flex min-h-11 items-center justify-between gap-3">
      <h2 id="system-settings-title" className="sr-only">{copy('Cài đặt ứng dụng', 'Application settings')}</h2>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info size={15} className="shrink-0" aria-hidden="true" />{copy('Chỉ áp dụng cho cộng đồng mới.', 'For new communities only.')}
      </p>
      {state === 'ready' ? <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 shrink-0 rounded-full" disabled={pending.size > 0}
        aria-label={copy('Tải lại cài đặt', 'Refresh settings')} aria-describedby={pending.size ? 'system-settings-refresh-help' : undefined}
        title={pending.size ? copy('Lưu hoặc hủy bản nháp trước.', 'Save or cancel your drafts first.') : copy('Tải lại cài đặt', 'Refresh settings')}
        onClick={() => void load()}><RefreshCcw size={17} aria-hidden="true" /></Button> : null}
    </header>
    {pending.size ? <p id="system-settings-refresh-help" className="sr-only">{copy('Lưu hoặc hủy bản nháp trước khi tải lại cài đặt.', 'Save or cancel your drafts before refreshing settings.')}</p> : null}
    {state === 'loading' ? <div role="status" aria-label={copy('Đang tải cài đặt', 'Loading settings')} className="community-preview">
      <Skeleton className="community-settings-art rounded-full" />
      <div className="community-settings-controls">{[0, 1].map(item => <div key={item} className="system-setting-row">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/3" /></div>
        <Skeleton className="h-11 w-16 rounded-full" />
      </div>)}</div>
    </div> : null}
    {state === 'error' || state === 'forbidden' ? <div role="alert" className="space-y-3 py-6 text-sm leading-6 text-foreground">
      <p>{state === 'forbidden' ? copy('Bạn không có quyền thay đổi cài đặt ứng dụng.', 'You do not have permission to change application settings.')
        : copy('Không tải được cài đặt. Thử lại để tiếp tục.', 'Could not load settings. Retry to continue.')}</p>
      <Button type="button" variant="outline" onClick={() => void load()}>{copy('Thử lại', 'Retry')}</Button>
    </div> : null}
    {state === 'ready' ? access?.type === 'BOOLEAN'
      ? <CommunitySettingsPreview enabled={access.value} editing={editing}>{editors}</CommunitySettingsPreview>
      : <div className="community-settings-controls">{editors}</div> : null}
    {state === 'ready' ? supplementaryTools : null}
  </section>;
}
