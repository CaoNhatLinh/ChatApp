import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRef, useState, type FC } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { UI_MOTION_CONFIG, UI_MOTION_VARIANTS } from '@/shared/constants/ui-motion-variants';

interface UserSettingsProfilePanelProps {
  userName: string;
  displayName: string;
  avatarUrl: string;
  nickname: string;
  isSaving: boolean;
  canSave: boolean;
  onDisplayNameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onNicknameChange: (value: string) => void;
  onSave: () => void;
}

export const UserSettingsProfilePanel: FC<UserSettingsProfilePanelProps> = ({
  userName,
  displayName,
  avatarUrl,
  nickname,
  isSaving,
  canSave,
  onDisplayNameChange,
  onAvatarChange,
  onNicknameChange,
  onSave,
}) => {
  const avatarUrlInputRef = useRef<HTMLInputElement>(null);
  const [showAvatarHint, setShowAvatarHint] = useState(false);

  const initials = displayName?.trim()?.charAt(0)?.toUpperCase() || userName?.charAt(0).toUpperCase() || '';

  const handleOpenAvatarInput = () => {
    setShowAvatarHint(true);
    avatarUrlInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    avatarUrlInputRef.current?.focus();
  };

  return (
    <motion.section
      className="space-y-8"
      initial={UI_MOTION_CONFIG.initialState}
      animate={UI_MOTION_CONFIG.animateState}
      variants={UI_MOTION_VARIANTS.panelReveal}
    >
      <div>
        <h2 className="text-2xl font-black uppercase tracking-tight">Hồ sơ cá nhân</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cập nhật tên hiển thị, biệt danh và ảnh đại diện của bạn.
        </p>
      </div>

      <motion.div
        className="rounded-3xl border border-border/60 bg-card/70 p-4 sm:p-6 flex flex-col gap-4 sm:items-center sm:flex-row sm:gap-6"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.rowReveal}
      >
        <button
          type="button"
          onClick={handleOpenAvatarInput}
          className="group relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-2xl border-4 border-background bg-primary/10 transition-transform"
          title="Đổi ảnh đại diện"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-3xl font-black text-primary">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-primary-foreground grid place-items-center">
            <span className="text-xs font-bold">Đổi</span>
          </span>
        </button>

        <div className="space-y-1">
          <p className="text-lg font-black">{displayName || 'Người dùng mới'}</p>
          <p className="text-xs uppercase font-bold tracking-[0.14em] text-muted-foreground">@{userName}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleOpenAvatarInput}
            className="mt-2"
          >
            Đổi ảnh đại diện
          </Button>
        </div>
      </motion.div>

      <motion.div className="space-y-2" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
        <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Tên hiển thị</label>
        <Input value={displayName} onChange={(event) => onDisplayNameChange(event.target.value)} placeholder="Nhập tên hiển thị" />
      </motion.div>
      <motion.div className="space-y-2" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
        <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Biệt danh</label>
        <Input value={nickname} onChange={(event) => onNicknameChange(event.target.value)} placeholder="Nhập biệt danh" />
      </motion.div>
      <motion.div className="space-y-2" initial={UI_MOTION_CONFIG.initialState} animate={UI_MOTION_CONFIG.animateState} variants={UI_MOTION_VARIANTS.rowReveal}>
        <label className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Avatar URL</label>
        <Input
          ref={avatarUrlInputRef}
          value={avatarUrl}
          onChange={(event) => onAvatarChange(event.target.value)}
          placeholder="Nhập link ảnh đại diện"
          inputMode="url"
        />
        {showAvatarHint && (
          <p className="text-[0.75rem] text-muted-foreground">
            Dán link ảnh trực tiếp (https://...) rồi nhấn Enter hoặc lưu ngay.
          </p>
        )}
      </motion.div>

      <motion.div
        className="flex justify-end pt-2"
        initial={UI_MOTION_CONFIG.initialState}
        animate={UI_MOTION_CONFIG.animateState}
        variants={UI_MOTION_VARIANTS.rowReveal}
      >
        <Button type="button" onClick={onSave} disabled={isSaving || !canSave} className="min-w-36">
          {isSaving ? (
            <motion.span
              initial={UI_MOTION_CONFIG.initialState}
              animate={UI_MOTION_CONFIG.animateState}
              variants={UI_MOTION_VARIANTS.loadingSpin}
            >
              <Loader2 size={18} />
            </motion.span>
          ) : (
            'Lưu thay đổi'
          )}
        </Button>
      </motion.div>
    </motion.section>
  );
};
