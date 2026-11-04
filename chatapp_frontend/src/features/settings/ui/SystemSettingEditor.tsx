import { useEffect, useId } from 'react';
import type { RefObject } from 'react';
import { Check, CircleAlert, Clock3, DoorOpen, LockKeyhole, Pencil, UsersRound } from 'lucide-react';
import { useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Switch } from '@/shared/ui/Switch';
import { ModalShell } from '@/shared/ui/ModalShell';
import type { SystemSetting, SystemSettingKey } from '../api/system-settings.api';
import { useSystemSettingEditor } from '../model/useSystemSettingEditor';
import type { SystemSettingsExitState } from '../model/system-settings-exit';

export function SystemSettingEditor({ setting, onDenied, onCurrent, onDraftState, open, onEdit, onClose, returnFocusRef }: {
  setting: SystemSetting; onDenied: () => void; onCurrent: (setting: SystemSetting) => void;
  onDraftState: (key: SystemSettingKey, state: SystemSettingsExitState) => void;
  open: boolean; onEdit: (trigger: HTMLButtonElement) => void; onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const model = useSystemSettingEditor(setting, onDenied, onCurrent);
  useEffect(() => {
    onDraftState(setting.key, model.exitState);
    return () => onDraftState(setting.key, 'clear');
  }, [onDraftState, setting.key, model.exitState]);
  const { locale } = useAppLocale();
  const copy = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const id = useId();
  const boolean = setting.type === 'BOOLEAN';
  const numberFormat = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US');
  const title = boolean ? copy('Cho phép tạo cộng đồng', 'Allow new communities') : copy('Số thành viên mặc định', 'Default member limit');
  const Icon = boolean ? model.setting.value ? DoorOpen : LockKeyhole : UsersRound;
  const DraftIcon = boolean ? model.draft ? DoorOpen : LockKeyhole : UsersRound;
  const draftPending = model.dirty || Boolean(model.reason);
  const FeedbackIcon = model.phase === 'uncertain' ? Clock3 : draftPending ? CircleAlert : Check;
  const feedback = model.phase === 'uncertain' ? copy('Chờ xác nhận', 'Awaiting confirmation')
    : draftPending ? copy('Chưa lưu', 'Unsaved')
    : model.phase === 'superseded' ? copy('Đã tải bản mới', 'Latest value loaded')
    : model.phase === 'saved'
      ? model.auditPending ? copy('Đã lưu · nhật ký đang cập nhật', 'Saved · audit pending') : copy('Đã lưu', 'Saved')
      : null;
  const messages: Partial<Record<typeof model.phase, string>> = {
    conflict: copy('Có bản mới. Nháp của bạn vẫn còn.', 'A newer version exists. Your draft is kept.'),
    error: copy('Chưa lưu được. Kiểm tra rồi thử lại.', 'Not saved. Check your changes and retry.'),
    uncertain: copy('Chưa nhận được xác nhận. Thử lại không tạo lần lưu mới.', 'No confirmation yet. Retry uses the same save.'),
    'reload-error': copy('Chưa tải được. Nháp vẫn còn.', 'Could not reload. Your draft is kept.'),
  };
  const status = boolean ? model.setting.value ? copy('Đang mở', 'Open') : copy('Tạm dừng', 'Paused')
    : numberFormat.format(Number(model.setting.value));
  return <article aria-labelledby={`${id}-title`} className="system-setting-row" data-type={setting.type}>
    <span className="system-setting-symbol" aria-hidden="true"><Icon size={21} strokeWidth={1.8} /></span>
    <div className="min-w-0">
      <h3 id={`${id}-title`} className="text-sm font-semibold">{title}</h3>
      <p className="system-setting-value flex items-center gap-2" data-type={setting.type}>
        {boolean ? <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${model.setting.value ? 'bg-success' : 'bg-muted-foreground'}`} /> : null}
        {status}
      </p>
      {feedback ? <p role="status" className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <FeedbackIcon size={13} aria-hidden="true" />{feedback}
      </p> : null}
    </div>
    <Button type="button" variant="outline" size="sm" className="min-h-11 min-w-11 rounded-full" aria-haspopup="dialog"
      aria-label={`${copy('Chỉnh sửa', 'Edit')} ${title}`} onClick={event => onEdit(event.currentTarget)}>
      <Pencil size={14} aria-hidden="true" />{copy('Sửa', 'Edit')}
    </Button>
    <ModalShell open={open} onClose={onClose} title={title} returnFocusRef={returnFocusRef}
      closeDisabled={model.busy} showClose={!model.busy}
      description={copy('Chỉ áp dụng cho cộng đồng mới.', 'Applies to new communities only.')}
      className="inset-auto left-1/2 top-1/2 h-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border sm:max-w-md">
      <form aria-label={title} className="space-y-5 p-4 sm:p-6" onSubmit={event => {
        event.preventDefault(); void model.save().then(saved => { if (saved) onClose(); });
      }}>
        <header className="flex items-center gap-3 pr-9">
          <span className="system-setting-symbol" aria-hidden="true"><DraftIcon size={21} strokeWidth={1.8} /></span>
          <p className="text-lg leading-tight font-semibold" aria-hidden="true">{title}</p>
        </header>
        <fieldset disabled={model.locked} className="space-y-4">
          {boolean ? <div className="flex min-h-12 items-center justify-between gap-4 rounded-lg bg-secondary/60 px-3">
            <label htmlFor={`${id}-value`} className="text-sm">{copy('Cho phép tạo mới', 'Allow creation')}</label>
            <Switch id={`${id}-value`} aria-label={title} checked={model.draft === true} onCheckedChange={model.editDraft} disabled={model.locked} />
          </div> : <div className="space-y-2">
            <Input id={`${id}-value`} aria-label={title} className="min-h-11" type="number" inputMode="numeric" min={setting.min ?? undefined} max={setting.max ?? undefined} step={1}
              value={typeof model.draft === 'string' ? model.draft : ''} aria-invalid={model.value === undefined || undefined}
              aria-describedby={`${id}-range`} onChange={event => model.editDraft(event.target.value)} />
            <p id={`${id}-range`} className={`text-xs ${model.value === undefined ? 'text-destructive' : 'text-muted-foreground'}`}>{copy('Số nguyên từ 2 đến 100.000.', 'Whole number from 2 to 100,000.')}</p>
            <div className="system-setting-presets" role="group" aria-label={copy('Chọn nhanh giới hạn', 'Member limit presets')}>
              {[50, 250, 1000].filter(value => setting.type === 'INTEGER' && value >= setting.min && value <= setting.max).map(value => <Button
                key={value} type="button" size="sm" variant="outline" className="min-h-11 rounded-full" aria-pressed={model.draft === String(value)}
                aria-label={copy(`Đặt giới hạn ${value} thành viên`, `Set limit to ${value} members`)}
                onClick={() => model.editDraft(String(value))}>{numberFormat.format(value)}</Button>)}
            </div>
          </div>}
          {String(model.draft) !== String(setting.defaultValue) ? <Button type="button" variant="ghost" size="sm" className="min-h-11" disabled={model.conflicted}
            onClick={() => model.editDraft(boolean ? setting.defaultValue : String(setting.defaultValue))}>{copy('Dùng mặc định', 'Use default')}</Button> : null}
          {draftPending ? <div className="system-setting-reason space-y-2">
            <label htmlFor={`${id}-reason`} className="text-sm">{copy('Lý do thay đổi', 'Reason for change')}</label>
            <Input id={`${id}-reason`} className="min-h-11" value={model.reason} maxLength={500} required
              placeholder={copy('Ghi vào nhật ký quản trị', 'Add to the audit log')}
              onChange={event => model.editReason(event.target.value)} />
          </div> : null}
        </fieldset>
        {messages[model.phase] ? <p role="alert" className="flex items-start gap-2 text-sm leading-6 text-destructive"><CircleAlert size={16} className="mt-1 shrink-0" />{messages[model.phase]}</p> : null}
        {model.conflicted || model.phase === 'reloading' ? <Button type="button" variant="outline" className="min-h-11" loading={model.phase === 'reloading'} onClick={() => void model.reload()}>{copy('Tải bản mới, bỏ nháp', 'Load latest, discard draft')}</Button> : null}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" className="min-h-11" disabled={model.locked || model.conflicted} onClick={() => { model.cancel(); onClose(); }}>{copy('Hủy', 'Cancel')}</Button>
          {model.phase === 'uncertain' ? <Button type="button" className="min-h-11" onClick={() => void model.save().then(saved => { if (saved) onClose(); })}>{copy('Thử lại lần lưu', 'Retry this save')}</Button>
            : <Button type="submit" className="min-h-11" disabled={!model.canSave} loading={model.phase === 'saving'}>{copy('Lưu thay đổi', 'Save changes')}</Button>}
        </div>
      </form>
    </ModalShell>
  </article>;
}
