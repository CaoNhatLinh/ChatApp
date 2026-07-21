import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const THRESHOLD_JUST_NOW_MS = 60 * 1000;

export const calculateTimeAgo = (timestamp: string | null | undefined): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < THRESHOLD_JUST_NOW_MS) return 'Vừa mới';

  return formatDistanceToNow(date, {
    addSuffix: true,
    locale: vi,
  });
};
