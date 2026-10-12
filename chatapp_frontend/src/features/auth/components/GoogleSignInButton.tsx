import { Button } from '@/shared/ui/Button';
import { localizeText } from '@/shared/i18n';

interface GoogleSignInButtonProps {
  loading: boolean;
  onClick: () => void;
}

const GoogleMark = () => (
  <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.715v2.259h2.909c1.702-1.567 2.684-3.878 2.684-6.615Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.259c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.963 10.706A5.41 5.41 0 0 1 3.682 9c0-.592.102-1.168.281-1.706V4.961H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z" />
    <path fill="#EA4335" d="M9 3.58c1.321 0 2.507.454 3.441 1.346l2.581-2.581C13.464.892 11.426 0 9 0A9 9 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z" />
  </svg>
);

export const GoogleSignInButton = ({ loading, onClick }: GoogleSignInButtonProps) => (
  <Button
    type="button"
    variant="outline"
    loading={loading}
    onClick={onClick}
    className="h-12 w-full border-border bg-background font-semibold text-foreground hover:bg-muted"
  >
    {loading ? null : <GoogleMark />}
    {localizeText(loading ? 'Đang kết nối Google...' : 'Tiếp tục với Google')}
  </Button>
);
