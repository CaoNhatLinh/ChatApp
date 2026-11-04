import { PhoneIncoming, PhoneOutgoing, Video } from 'lucide-react';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { localizeText, useAppLocale } from '@/shared/i18n';
import type { CallHistoryEntry, CallHistoryOutcome } from '../api/call-history.api';

const outcomeLabels: Record<CallHistoryOutcome, string> = {
  RINGING: 'Đang đổ chuông', ACCEPTED: 'Đã nhận lời', CANCELLED: 'Đã hủy gọi', DECLINED: 'Đã từ chối',
  MISSED: 'Cuộc gọi nhỡ', UNANSWERED: 'Không có người nhận', ENDED: 'Đã kết thúc', FAILED: 'Cuộc gọi bị gián đoạn',
};
const callOutcomeLabel = (entry: CallHistoryEntry) => localizeText(outcomeLabels[entry.outcome]);

function useCallHistoryName(entry: CallHistoryEntry, actorId: string) {
  const peerId = entry.callerId === actorId ? entry.calleeId : entry.callerId;
  return useMessengerStore(state => {
    const room = state.conversations.find(room => room.conversationId === entry.conversationId && room.type === 'dm');
    const peer = room?.otherParticipant;
    return peer?.userId === peerId ? peer.displayName || peer.userName : undefined;
  });
}

export function CallHistorySummary({ entry, actorId }: { entry: CallHistoryEntry; actorId: string }) {
  const name = useCallHistoryName(entry, actorId);
  const { locale } = useAppLocale();
  const Icon = entry.callType === 'VIDEO' ? Video : entry.direction === 'INCOMING' ? PhoneIncoming : PhoneOutgoing;
  return <>
    <Icon aria-hidden="true" className={`mt-1 h-5 w-5 shrink-0 ${entry.outcome === 'MISSED' ? 'text-destructive' : 'text-muted-foreground'}`} />
    <span className="min-w-0 flex-1 space-y-1 text-left">
      <span className="block break-words font-semibold">{name || localizeText(entry.direction === 'INCOMING' ? 'Cuộc gọi đến' : 'Cuộc gọi đi')}</span>
      <span className="block text-sm text-muted-foreground">{localizeText(entry.direction === 'INCOMING' ? 'Cuộc gọi đến' : 'Cuộc gọi đi')} · {localizeText(entry.callType === 'VIDEO' ? 'Video' : 'Thoại')} · {callOutcomeLabel(entry)}</span>
      <time dateTime={entry.createdAt} className="block text-xs tabular-nums text-muted-foreground">{new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC',
      }).format(new Date(entry.createdAt))}</time>
    </span>
  </>;
}

export function CallHistoryFacts({ entry, actorId }: { entry: CallHistoryEntry; actorId: string }) {
  const name = useCallHistoryName(entry, actorId);
  const { locale } = useAppLocale();
  const format = (time: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(time));
  return <article className="space-y-6">
    <div className="flex gap-3"><CallHistorySummary entry={entry} actorId={actorId} /></div>
    <p className="text-sm leading-6 text-muted-foreground">{localizeText('Mốc nhận lời không xác nhận âm thanh hoặc video đã kết nối.')}</p>
    <section aria-label={localizeText('Người tham gia')}>
      <h3 className="text-sm font-semibold">{localizeText('Người tham gia')}</h3>
      <div className="divide-y divide-border">
        {entry.participants.map(participant => <div key={participant.userId} className="space-y-2 py-4">
          <p className="break-words font-semibold">{participant.userId === actorId ? localizeText('Bạn') : name || localizeText('Người tham gia')}</p>
          <p className="text-sm text-muted-foreground">{localizeText(participant.role === 'CALLER' ? 'Người gọi' : 'Người nhận')}</p>
          <p className="break-all text-xs text-muted-foreground"><span className="select-all">{participant.userId}</span></p>
          <p className="text-sm leading-6">{participant.initiatedAt ? <>{localizeText('Bắt đầu gọi')}: <time dateTime={participant.initiatedAt}>{format(participant.initiatedAt)}</time></>
            : participant.acceptedAt ? <>{localizeText('Nhận lời')}: <time dateTime={participant.acceptedAt}>{format(participant.acceptedAt)}</time></>
              : localizeText('Không có mốc nhận lời.')}</p>
        </div>)}
      </div>
    </section>
    {entry.endedAt ? <p className="text-sm">{localizeText('Kết thúc')}: <time dateTime={entry.endedAt}>{format(entry.endedAt)}</time></p> : null}
    <p className="text-xs text-muted-foreground">{localizeText('Thời gian hiển thị theo UTC.')}</p>
  </article>;
}
