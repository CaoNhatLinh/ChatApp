import { useState } from 'react';
import type { ReactNode } from 'react';
import { DoorOpen, LockKeyhole, UsersRound } from 'lucide-react';
import { BrandMark } from '@/shared/ui/Brand';
import { useAppLocale } from '@/shared/i18n';
import type { SystemSettingKey } from '../api/system-settings.api';

export function CommunitySettingsPreview({ enabled, editing, children }: {
  enabled: boolean; editing: SystemSettingKey | null; children: ReactNode;
}) {
  const { locale } = useAppLocale();
  const [imageFailed, setImageFailed] = useState(false);
  return <figure className="community-preview" data-enabled={enabled} data-editing={editing ?? undefined}
    aria-label={locale === 'vi' ? 'Xem trước cài đặt đã lưu' : 'Saved settings preview'}>
    <div className="community-settings-art" aria-hidden="true">
      <span className="community-settings-backdrop" />
      {imageFailed ? <BrandMark className="h-24 w-24" />
        : <img src="/noi-community-settings.webp" width="640" height="640" alt="" decoding="async"
          onError={() => setImageFailed(true)} />}
      <span className="community-settings-access">
        <span className="community-settings-door">{enabled ? <DoorOpen size={21} /> : <LockKeyhole size={21} />}</span>
        <span className="community-settings-people"><UsersRound size={21} /></span>
      </span>
    </div>
    <div className="community-settings-controls">{children}</div>
  </figure>;
}
