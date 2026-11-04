import type { AdminAnalyticsPoint } from '../api/admin.api';

export function summarizeAdminActivity(points: AdminAnalyticsPoint[], selectedDay?: string) {
  const days = new Map<string, number>();
  const types = new Map<string, number>();
  let count = 0;
  for (const point of points) {
    days.set(point.eventDay, (days.get(point.eventDay) ?? 0) + 1);
    if (selectedDay && point.eventDay !== selectedDay) continue;
    types.set(point.eventType, (types.get(point.eventType) ?? 0) + 1);
    count++;
  }
  return {
    days: [...days].sort(([left], [right]) => left.localeCompare(right)),
    types: [...types].sort(([left, a], [right, b]) => b - a || left.localeCompare(right)),
    count,
  };
}
