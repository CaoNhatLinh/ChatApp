import { useEffect, useState } from 'react';
import apiClient from '@/shared/api/apiClient';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { localizeText } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { MessageItem } from '../chat/MessageItem';
import { mapToMessage, type BackendMessage } from '../../api/messenger.api';
import type { ChatBubbleStylePreset } from '@/features/settings/constants/chat-theme.constants';
import { mapCanonicalPollView } from '../../api/poll.api';
import { PollCard } from '../Poll/PollCard';
import type { PollData } from '../../types/messenger.types';

function ThreadSender({ senderId }: { senderId: string }) {
  const user = useAuthStore(state => state.user);
  const [name, setName] = useState<string>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (user?.userId === senderId) return;
    const controller = new AbortController(); setName(undefined); setError(false);
    void apiClient.get<{ userId: string; displayName: string }>(`/users/${senderId}`, { signal: controller.signal })
      .then(({ data }) => {
        if (data.userId !== senderId || !data.displayName?.trim()) throw new Error('Invalid thread sender');
        if (!controller.signal.aborted) setName(data.displayName);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [senderId, user?.userId, retry]);
  if (user?.userId === senderId) return <span>{localizeText('Bạn')}</span>;
  if (error) return <button type="button" className="focus-ring underline underline-offset-4" onClick={() => setRetry(value => value + 1)}>{localizeText('Tải lại tên người gửi')}</button>;
  return <span>{name ?? localizeText('Đang tải tên người gửi…')}</span>;
}

function ThreadPoll({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<PollData>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setPoll(undefined); setError(false);
    void apiClient.get(`/polls/${pollId}`, { signal: controller.signal }).then(({ data }) => {
      const next = mapCanonicalPollView(data);
      if (next.pollId !== pollId) throw new Error('Invalid thread poll');
      if (!controller.signal.aborted) setPoll(next);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [pollId, retry]);
  if (error) return <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{localizeText('Tải lại bình chọn')}</Button>;
  return poll ? <PollCard poll={poll} /> : <p role="status" className="text-sm text-muted-foreground">{localizeText('Đang tải bình chọn…')}</p>;
}

export function ThreadMessage({ message, bubbleStyle, onOpenLibrary }: {
  message: BackendMessage; bubbleStyle?: ChatBubbleStylePreset; onOpenLibrary: () => void;
}) {
  return <article className="min-w-0 space-y-2 py-3">
    <div className="text-xs font-medium text-foreground"><ThreadSender senderId={message.senderId} /></div>
    {!message.isDeleted && message.messageType === 'POLL' && message.pollId ? <ThreadPoll pollId={message.pollId} /> :
      <MessageItem message={mapToMessage(message)} showAvatar={false} readOnly roomBubbleStyle={bubbleStyle} />}
    {!message.isDeleted && message.hasAttachments ? <Button size="sm" variant="outline" onClick={onOpenLibrary}>{localizeText('Xem thư viện ảnh và tệp')}</Button> : null}
  </article>;
}
