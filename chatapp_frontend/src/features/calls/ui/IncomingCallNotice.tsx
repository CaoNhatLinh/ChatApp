'use client';

import axios from 'axios';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { PhoneIncoming, Video, X } from 'lucide-react';
import { useMessengerStore } from '@/features/messenger/model/messenger.store';
import { getConversationById } from '@/features/messenger/api/messenger.api';
import { useFriendStore } from '@/features/relationships/model/friend.store';
import { getSessionGeneration } from '@/shared/auth/access-token';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { useIncomingCallInbox } from '../hooks/useIncomingCallInbox';
import { useIncomingCallStore } from '../model/incoming-call.store';
import { nextIncomingCall } from '../model/incoming-call-inbox';
import { IncomingCallLookupFeedback } from './IncomingCallLookupFeedback';

export function IncomingCallNotice({ onFeedbackHeightChange }: { onFeedbackHeightChange: (height: number) => void }) {
  useAppLocale();
  const router = useRouter(), pathname = usePathname();
  const { items, now, actorId, generation, enabled, lookupStatus, retry, loadMore, dismiss } = useIncomingCallInbox();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setDesktop(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const visibleRoom = useMessengerStore(state => pathname === '/app' && state.activeView === 'chat'
    && !state.error && (desktop || !state.isSidebarOpen)
    && state.conversations.some(room => room.conversationId === state.activeConversationId && !room.isDeleted)
    ? state.activeConversationId ?? undefined : undefined);
  const blocked = useFriendStore(state => state.blockedUserIds);
  const call = nextIncomingCall(items.filter(item => !blocked.has(item.snapshot.callerId)), now, visibleRoom);
  const roomId = call?.conversationId, callId = call?.callId, callerId = call?.callerId;
  const key = `${actorId}/${generation}/${roomId}/${callId}`;
  const knownName = useMessengerStore(state => {
    const room = state.conversations.find(room => room.conversationId === roomId && room.type === 'dm' && !room.isDeleted);
    const peer = room?.otherParticipant;
    return peer && peer.userId === callerId ? peer.displayName || peer.userName : undefined;
  });
  const [caller, setCaller] = useState<{ key: string; name: string } | null>(null);
  useEffect(() => {
    if (!enabled || !roomId || !callId || !callerId || knownName) return;
    const request = new AbortController();
    void getConversationById(roomId, request.signal).then(room => {
      if (request.signal.aborted || generation !== getSessionGeneration()) return;
      if (room.type !== 'dm' || room.isDeleted || room.otherParticipant?.userId !== callerId) {
        useIncomingCallStore.getState().hide(roomId, callId); return;
      }
      const name = room.otherParticipant.displayName || room.otherParticipant.userName;
      if (name) setCaller({ key, name });
    }).catch(error => {
      if (!request.signal.aborted && generation === getSessionGeneration() && axios.isAxiosError(error)
        && [403, 404].includes(error.response?.status ?? 0)) useIncomingCallStore.getState().hide(roomId, callId);
    });
    return () => request.abort();
  }, [callId, callerId, enabled, generation, key, knownName, roomId]);
  const feedbackVisible = lookupStatus !== 'ready' && lookupStatus !== 'dismissed';
  const feedback = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = feedback.current;
    if (!enabled || !feedbackVisible || !element) {
      onFeedbackHeightChange(0);
      return;
    }
    const measure = () => onFeedbackHeightChange(element.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, feedbackVisible, onFeedbackHeightChange]);
  if (!enabled || !call && !feedbackVisible) return null;
  const name = knownName || (caller?.key === key ? caller.name : undefined);
  const open = () => {
    if (!call) return;
    useMessengerStore.getState().setActiveView('chat');
    useMessengerStore.getState().setSidebarOpen(false);
    router.push(`/app?conversationId=${encodeURIComponent(call.conversationId)}`, { scroll: false });
  };
  const Icon = call?.callType === 'VIDEO' ? Video : PhoneIncoming;
  return <>
    {feedbackVisible ? <aside ref={feedback} aria-label={localizeText('Kiểm tra cuộc gọi đến')}
      className="relative border-b border-border bg-card px-4 py-2 text-card-foreground md:px-6">
      <IncomingCallLookupFeedback status={lookupStatus} retry={retry} loadMore={loadMore} dismiss={dismiss} />
    </aside> : null}
    {call ? <aside aria-label={localizeText('Cuộc gọi đến')} className="fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 rounded-lg border border-border bg-card p-4 text-card-foreground md:bottom-6 md:left-auto md:w-96">
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-primary" />
      <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{localizeText(call.callType === 'VIDEO' ? 'Cuộc gọi video đến' : 'Cuộc gọi thoại đến')}</p>
        <p className="mt-1 break-words text-base leading-6">{name || localizeText('Mở hội thoại để xem và nhận cuộc gọi.')}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label={localizeText('Ẩn lời nhắc cuộc gọi')}
        onClick={() => useIncomingCallStore.getState().hide(call.conversationId, call.callId)}><X aria-hidden="true" className="h-4 w-4" /></Button>
    </div>
    <Button type="button" size="sm" className="mt-4" onClick={open}>{localizeText('Mở cuộc trò chuyện')}</Button>
    </aside> : null}
  </>;
}
