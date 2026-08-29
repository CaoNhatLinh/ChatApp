import * as React from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';
import {
    listRoomAuditEvents,
    type RoomAuditEvent,
} from '@/features/messenger/api/messenger.api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Skeleton } from '@/shared/ui/Skeleton';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { logger } from '@/shared/lib/logger';

const EVENT_LABELS: Record<string, string> = {
    CONVERSATION_CREATE: 'Đã tạo phòng',
    CONVERSATION_CHAT_POLICY_UPDATE: 'Đã cập nhật chính sách chat',
    CONVERSATION_NOTIFICATION_POLICY_UPDATE: 'Đã cập nhật chính sách thông báo',
    CONVERSATION_PIN: 'Đã ghim phòng',
    CONVERSATION_UNPIN: 'Đã bỏ ghim phòng',
    COMMUNITY_JOIN: 'Đã tham gia cộng đồng',
    COMMUNITY_JOIN_REQUEST: 'Đã gửi yêu cầu tham gia',
    MEMBER_ADD: 'Đã thêm thành viên',
    MEMBER_REMOVE: 'Đã xóa thành viên',
    MEMBER_LEFT: 'Thành viên đã rời phòng',
    MEMBER_CHAT_POLICY_UPDATE: 'Đã cập nhật chính sách thành viên',
    MEMBER_NOTIFICATION_POLICY_UPDATE: 'Đã cập nhật thông báo thành viên',
    ROLE_CREATED: 'Đã tạo vai trò',
    ROLE_UPDATED: 'Đã cập nhật vai trò',
    ROLE_DELETED: 'Đã xóa vai trò',
    ROLES_ASSIGNED: 'Đã gán vai trò',
    OWNERSHIP_TRANSFERRED: 'Đã chuyển quyền sở hữu',
    MESSAGE_SEND: 'Đã gửi tin nhắn',
    MESSAGE_EDIT: 'Đã sửa tin nhắn',
    MESSAGE_DELETE: 'Đã xóa tin nhắn',
    MESSAGE_PIN: 'Đã ghim tin nhắn',
    MESSAGE_UNPIN: 'Đã bỏ ghim tin nhắn',
    MESSAGE_REACTION_ADD: 'Đã thêm cảm xúc',
    MESSAGE_REACTION_REMOVE: 'Đã gỡ cảm xúc',
    POLL_CREATE: 'Đã tạo bình chọn',
    POLL_VOTE: 'Đã bình chọn',
    POLL_VOTE_CHANGE: 'Đã đổi lựa chọn bình chọn',
    POLL_VOTE_REMOVE: 'Đã rút bình chọn',
    POLL_CLOSE: 'Đã đóng bình chọn',
    INVITE_CREATE: 'Đã tạo lời mời',
    INVITE_REVOKE: 'Đã thu hồi lời mời',
    INVITE_DECLINE: 'Đã từ chối lời mời',
    JOIN_BY_INVITE: 'Đã tham gia bằng lời mời',
    JOIN_REQUEST_CREATE: 'Đã tạo yêu cầu tham gia',
    JOIN_REQUEST_APPROVE: 'Đã duyệt yêu cầu tham gia',
    JOIN_REQUEST_DECLINE: 'Đã từ chối yêu cầu tham gia',
    REPORT_CREATED: 'Đã gửi báo cáo',
    SANCTION_IMPOSED: 'Đã áp dụng chế tài',
    SANCTION_REVOKED: 'Đã gỡ chế tài',
    SANCTION_EXPIRED: 'Chế tài đã hết hạn',
    CALL_START: 'Đã bắt đầu cuộc gọi',
    ADMIN_CONVERSATION_CHAT_POLICY_UPDATE: 'Quản trị viên đã cập nhật chính sách chat',
    ADMIN_CONVERSATION_ARCHIVE: 'Quản trị viên đã lưu trữ phòng',
    ADMIN_CONVERSATION_RESTORE: 'Quản trị viên đã khôi phục phòng',
    REPORT_STATUS_UPDATE: 'Đã cập nhật trạng thái báo cáo',
    ADMIN_MESSAGE_VIEW: 'Quản trị viên đã xem tin nhắn',
};

interface RoomAuditTimelineProps {
    conversationId: string;
}

const requireSupportedEvents = (events: RoomAuditEvent[]): RoomAuditEvent[] => {
    const unsupported = events.find((event) => EVENT_LABELS[event.eventType] === undefined);
    if (unsupported) throw new Error(`Unsupported room audit event: ${unsupported.eventType}`);
    return events;
};

export function RoomAuditTimeline({ conversationId }: RoomAuditTimelineProps) {
    const { locale } = useAppLocale();
    const [month, setMonth] = React.useState(() => new Date().toISOString().slice(0, 7));
    const [events, setEvents] = React.useState<RoomAuditEvent[]>([]);
    const [nextCursor, setNextCursor] = React.useState<string | null>(null);
    const [hasNext, setHasNext] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
    const requestRef = React.useRef(0);

    const load = React.useCallback(async (cursor?: string) => {
        const requestId = ++requestRef.current;
        if (cursor) setLoadingMore(true);
        else setLoading(true);
        setErrorMessage(null);
        try {
            const page = await listRoomAuditEvents(conversationId, month, cursor);
            const supportedEvents = requireSupportedEvents(page.content);
            if (requestId !== requestRef.current) return;
            setEvents((current) => cursor ? [...current, ...supportedEvents] : supportedEvents);
            setNextCursor(page.nextCursor);
            setHasNext(page.hasNext);
        } catch (error) {
            if (requestId !== requestRef.current) return;
            logger.error('[RoomAuditTimeline] Load failed', error instanceof Error ? error.message : String(error));
            setErrorMessage(getUserFacingErrorMessage(error, localizeText('Không thể tải nhật ký phòng.')));
        } finally {
            if (requestId === requestRef.current) {
                setLoading(false);
                setLoadingMore(false);
            }
        }
    }, [conversationId, month]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const formatDate = (value: string) => new Intl.DateTimeFormat(
        locale === 'vi' ? 'vi-VN' : 'en-US',
        { dateStyle: 'medium', timeStyle: 'short' },
    ).format(new Date(value));

    return (
        <div className="space-y-3">
            <div>
                <label htmlFor="room-audit-month" className="text-xs font-semibold">{localizeText('Tháng nhật ký (UTC)')}</label>
                <Input
                    id="room-audit-month"
                    className="mt-1"
                    type="month"
                    value={month}
                    onChange={(event) => setMonth(event.target.value)}
                />
            </div>
            {loading ? (
                <div className="space-y-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
            ) : errorMessage ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-destructive">{errorMessage}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void load()}>
                        <RefreshCw className="h-4 w-4" /> {localizeText('Thử lại')}
                    </Button>
                </div>
            ) : events.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{localizeText('Chưa có sự kiện trong tháng này.')}</p>
            ) : (
                <div className="space-y-2">
                    {events.map((event) => (
                        <article key={event.eventId} className="rounded-xl border border-border/70 bg-background p-3">
                            <div className="flex items-start gap-2">
                                <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold">{localizeText(EVENT_LABELS[event.eventType])}</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(event.createdAt)}</p>
                                    <p className="mt-1 break-all text-[11px] text-muted-foreground">
                                        {localizeText('Người thao tác:')} {event.actorId ?? localizeText('Hệ thống')}
                                        {event.targetUserId ? ` · ${localizeText('Đối tượng:')} ${event.targetUserId}` : ''}
                                    </p>
                                    {event.reasonCode ? <p className="mt-1 text-[11px]">{localizeText('Lý do:')} {event.reasonCode}</p> : null}
                                </div>
                            </div>
                        </article>
                    ))}
                    {hasNext && nextCursor ? (
                        <Button type="button" variant="outline" size="sm" className="w-full" loading={loadingMore} onClick={() => void load(nextCursor)}>
                            {localizeText('Tải thêm sự kiện')}
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    );
}
