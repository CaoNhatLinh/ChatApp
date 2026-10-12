import { useState } from 'react';
import { User, UserCircle } from 'lucide-react';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { AuthField } from '../ui/components/AuthField';

interface GoogleRegistrationFormProps {
  suggestedDisplayName: string;
  loading: boolean;
  onSubmit: (input: { username: string; displayName: string }) => void;
  onCancel: () => void;
}

export const GoogleRegistrationForm = ({
  suggestedDisplayName,
  loading,
  onSubmit,
  onCancel,
}: GoogleRegistrationFormProps) => {
  const [displayName, setDisplayName] = useState(suggestedDisplayName);
  const [username, setUsername] = useState('');

  return (
    <form
      className="space-y-4 border-t border-border pt-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ username, displayName });
      }}
    >
      <div>
        <h2 className="text-base font-bold text-foreground">{localizeText('Chọn tên của bạn trong Nối')}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {localizeText('Google đã xác minh bạn. Giờ chọn tên mọi người sẽ dùng để tìm bạn.')}
        </p>
      </div>
      <AuthField
        label={localizeText('Tên đăng nhập')}
        icon={<User size={18} />}
        value={username}
        onValueChange={(event) => setUsername(event.target.value)}
        minLength={3}
        maxLength={32}
        pattern="[A-Za-z0-9._-]+"
        autoComplete="username"
        disabled={loading}
        required
        placeholder={localizeText('Tên đăng nhập mong muốn')}
      />
      <AuthField
        label={localizeText('Tên hiển thị')}
        icon={<UserCircle size={18} />}
        value={displayName}
        onValueChange={(event) => setDisplayName(event.target.value)}
        maxLength={80}
        autoComplete="name"
        disabled={loading}
        required
        placeholder={localizeText('Tên bạn muốn mọi người nhìn thấy')}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={loading} onClick={onCancel}>
          {localizeText('Dùng tài khoản khác')}
        </Button>
        <Button type="submit" loading={loading}>
          {localizeText(loading ? 'Đang tạo không gian...' : 'Vào Nối')}
        </Button>
      </div>
    </form>
  );
};
