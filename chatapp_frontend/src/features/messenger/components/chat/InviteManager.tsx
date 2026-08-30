import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Link2, Plus, QrCode, Trash2, UserCheck, UserX } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
    createInvite,
    listInvites,
    listJoinRequests,
    resolveJoinRequest,
    revokeInvite,
    type InviteLinkRecord,
    type JoinRequestView,
} from '../../api/invite.api';
import { localizeText, useAppLocale } from '@/shared/i18n';
import { getUserFacingErrorMessage } from '@/shared/lib/user-facing-error';
import { notifyError, notifySuccess } from '@/shared/lib/notification';
import { logger } from '@/shared/lib/logger';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

const INITIAL_VISIBLE_ITEMS = 3;

export function InviteManager({ conversationId }: { conversationId: string }) {
    useAppLocale();
    const [links, setLinks] = useState<InviteLinkRecord[]>([]);
    const [requests, setRequests] = useState<JoinRequestView[]>([]);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
    const [selectedInviteKind, setSelectedInviteKind] = useState<'LINK' | 'QR'>('LINK');
    const [kind, setKind] = useState<'LINK' | 'QR'>('LINK');
    const [policy, setPolicy] = useState<'DIRECT_JOIN' | 'REQUEST_APPROVAL'>('DIRECT_JOIN');
    const [isCreating, setIsCreating] = useState(false);
    const [visibleLinkCount, setVisibleLinkCount] = useState(INITIAL_VISIBLE_ITEMS);
    const [visibleRequestCount, setVisibleRequestCount] = useState(INITIAL_VISIBLE_ITEMS);
    const [revokeTarget, setRevokeTarget] = useState<InviteLinkRecord | null>(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const managerIdentityRef = useRef<object>({});

    const refresh = async (identity: object = managerIdentityRef.current) => {
        if (identity !== managerIdentityRef.current) return;
        setLoading(true);
        try {
            const [nextLinks, nextRequests] = await Promise.all([
                listInvites(conversationId),
                listJoinRequests(conversationId),
            ]);
            if (identity !== managerIdentityRef.current) return;
            setLinks(nextLinks);
            setRequests(nextRequests);
        } finally {
            if (identity === managerIdentityRef.current) setLoading(false);
        }
    };

    useEffect(() => {
        const identity = {};
        managerIdentityRef.current = identity;
        setError(null);
        void refresh(identity).catch((refreshError: unknown) => {
            if (identity !== managerIdentityRef.current) return;
            logger.error('[InviteManager] Failed to load invite data', refreshError instanceof Error ? refreshError.message : String(refreshError));
            setLoading(false);
            setError(getUserFacingErrorMessage(refreshError, localizeText('Bạn không có quyền quản lý lời mời.')));
        });
        return () => {
            if (managerIdentityRef.current === identity) managerIdentityRef.current = {};
        };
        // conversationId is the complete identity of this manager instance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

    const retryLoad = () => {
        const identity = managerIdentityRef.current;
        setError(null);
        void refresh(identity).catch((refreshError: unknown) => {
            if (identity !== managerIdentityRef.current) return;
            logger.error('[InviteManager] Invite data retry failed', refreshError instanceof Error ? refreshError.message : String(refreshError));
            setLoading(false);
            setError(getUserFacingErrorMessage(refreshError, localizeText('Bạn không có quyền quản lý lời mời.')));
        });
    };

    const makeInvite = async () => {
        setBusy(true);
        setError(null);
        try {
            const created = await createInvite(conversationId, {
                inviteKind: kind,
                joinPolicy: policy,
                displayName: kind === 'QR' ? 'QR phòng chat' : 'Link phòng chat',
                durationMinutes: 7 * 24 * 60,
            });
            setSelectedUrl(created.joinUrl);
            setSelectedLinkId(created.invite.linkId);
            setSelectedInviteKind(created.invite.inviteKind);
            setIsCreating(false);
            await refresh();
        } catch (inviteError: unknown) {
            const message = getUserFacingErrorMessage(inviteError, localizeText('Không thể tạo lời mời. Hãy kiểm tra quyền của bạn.'));
            logger.error('[InviteManager] Failed to create invite', inviteError instanceof Error ? inviteError.message : String(inviteError));
            setError(message);
            notifyError(message);
        } finally {
            setBusy(false);
        }
    };

    const handleCopy = async () => {
        if (!selectedUrl) return;
        try {
            await navigator.clipboard.writeText(selectedUrl);
            notifySuccess(localizeText('Đã sao chép liên kết.'));
        } catch (copyError: unknown) {
            logger.error('[InviteManager] Failed to copy invite link', copyError instanceof Error ? copyError.message : String(copyError));
            notifyError(getUserFacingErrorMessage(copyError, localizeText('Không thể sao chép liên kết.')));
        }
    };

    const handleRevoke = async (link: InviteLinkRecord) => {
        const actionKey = `revoke:${link.linkId}`;
        setPendingAction(actionKey);
        try {
            await revokeInvite(link.linkToken);
            await refresh();
            if (selectedLinkId === link.linkId) {
                setSelectedUrl(null);
                setSelectedLinkId(null);
            }
            setRevokeTarget(null);
            notifySuccess(localizeText('Đã thu hồi lời mời.'));
        } catch (revokeError: unknown) {
            logger.error('[InviteManager] Failed to revoke invite', revokeError instanceof Error ? revokeError.message : String(revokeError));
            notifyError(getUserFacingErrorMessage(revokeError, localizeText('Không thể thu hồi lời mời.')));
        } finally {
            setPendingAction(null);
        }
    };

    const activeLinks = links.filter(link => link.isActive);
    const pendingRequests = requests.filter(request => request.status === 'PENDING');

    const handleResolve = async (request: JoinRequestView, decision: 'APPROVE' | 'DECLINE') => {
        const actionKey = `${decision.toLowerCase()}:${request.requestId}`;
        setPendingAction(actionKey);
        try {
            await resolveJoinRequest(request, decision);
            await refresh();
            notifySuccess(localizeText(decision === 'APPROVE' ? 'Đã duyệt yêu cầu tham gia.' : 'Đã từ chối yêu cầu tham gia.'));
        } catch (resolveError: unknown) {
            logger.error('[InviteManager] Failed to resolve join request', resolveError instanceof Error ? resolveError.message : String(resolveError));
            notifyError(getUserFacingErrorMessage(resolveError, localizeText('Không thể xử lý yêu cầu tham gia.')));
        } finally {
            setPendingAction(null);
        }
    };

    if (loading && links.length === 0 && requests.length === 0) {
        return <div className="rounded-xl border border-border/50 p-3 text-xs text-muted-foreground" role="status">{localizeText('Đang tải danh sách lời mời...')}</div>;
    }

    if (error && links.length === 0 && requests.length === 0) {
        return <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive" role="alert"><span>{error}</span><button type="button" onClick={retryLoad} className="focus-ring shrink-0 rounded-md px-2 py-1 font-semibold text-primary hover:bg-primary/10">{localizeText('Thử lại')}</button></div>;
    }

    return (
        <section className="space-y-4" aria-labelledby="invite-manager-title">
            {error ? <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive" role="alert"><span>{error}</span><button type="button" onClick={retryLoad} className="focus-ring shrink-0 rounded-md px-2 py-1 font-semibold text-primary hover:bg-primary/10">{localizeText('Thử lại')}</button></div> : null}
            <header className="flex items-center justify-between gap-3">
                <h4 id="invite-manager-title" className="text-sm font-semibold">{localizeText('Lời mời & yêu cầu tham gia')}</h4>
                <Button type="button" size="sm" variant={isCreating ? 'secondary' : 'default'} onClick={() => setIsCreating(value => !value)}>
                    <Plus className="size-4" />
                    {isCreating ? localizeText('Đóng') : localizeText('Tạo lời mời')}
                </Button>
            </header>

            {pendingRequests.length > 0 ? (
                <div className="space-y-2" aria-labelledby="pending-requests-title">
                    <div className="flex items-center justify-between gap-3">
                        <h5 id="pending-requests-title" className="text-sm font-medium">{localizeText('Đang chờ duyệt')} · {pendingRequests.length}</h5>
                    </div>
                    {pendingRequests.slice(0, visibleRequestCount).map(request => (
                        <div key={request.requestId} className="flex items-center justify-between gap-3 border-t border-border/60 py-3 first:border-t-0">
                            <p className="min-w-0 truncate text-sm" title={request.userId}>
                                {localizeText('Người dùng')} · <span className="font-mono text-xs text-muted-foreground">{request.userId.slice(-8)}</span>
                            </p>
                            <div className="flex shrink-0 gap-1">
                                <Button type="button" size="icon" variant="ghost" disabled={pendingAction !== null} onClick={() => void handleResolve(request, 'APPROVE')} aria-label={localizeText('Duyệt yêu cầu')}>
                                    <UserCheck className="size-4 text-success" />
                                </Button>
                                <Button type="button" size="icon" variant="ghost" disabled={pendingAction !== null} onClick={() => void handleResolve(request, 'DECLINE')} aria-label={localizeText('Từ chối yêu cầu')}>
                                    <UserX className="size-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {visibleRequestCount < pendingRequests.length ? (
                        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setVisibleRequestCount(count => count + INITIAL_VISIBLE_ITEMS)}>
                            {localizeText('Xem thêm')}
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {isCreating ? <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex gap-2" role="group" aria-label={localizeText('Loại lời mời')}>
                    <Button type="button" variant={kind === 'LINK' ? 'secondary' : 'ghost'} className="flex-1" aria-pressed={kind === 'LINK'} onClick={() => setKind('LINK')}><Link2 className="size-4" />{localizeText('Liên kết')}</Button>
                    <Button type="button" variant={kind === 'QR' ? 'secondary' : 'ghost'} className="flex-1" aria-pressed={kind === 'QR'} onClick={() => setKind('QR')}><QrCode className="size-4" />QR</Button>
                </div>
                <label className="block space-y-2 text-sm font-medium">
                    <span>{localizeText('Cách tham gia')}</span>
                    <select value={policy} onChange={event => setPolicy(event.target.value as typeof policy)} className="focus-ring h-10 w-full rounded-[var(--radius-md)] border border-border bg-background px-3 text-sm">
                        <option value="DIRECT_JOIN">{localizeText('Tham gia ngay')}</option>
                        <option value="REQUEST_APPROVAL">{localizeText('Cần quản lý duyệt')}</option>
                    </select>
                </label>
                <Button type="button" onClick={() => void makeInvite()} loading={busy} className="w-full">
                    <Check className="size-4" /> {localizeText('Tạo lời mời 7 ngày')}
                </Button>
            </div> : null}

            {selectedUrl && (
                <div className="space-y-3 border-t border-border/60 pt-4 text-center">
                    {selectedInviteKind === 'QR' && <div className="mx-auto w-fit rounded-[var(--radius-md)] bg-white p-3"><QRCodeSVG value={selectedUrl} size={152} level="H" /></div>}
                    <p className="text-sm font-medium">{localizeText('Lời mời đã sẵn sàng')}</p>
                    <Button type="button" variant="secondary" onClick={() => void handleCopy()} className="mx-auto"><Copy className="size-4" /> {localizeText('Sao chép liên kết')}</Button>
                </div>
            )}

            {activeLinks.length > 0 ? <details className="border-t border-border/60 pt-3">
                <summary className="focus-ring cursor-pointer list-none rounded-[var(--radius-sm)] py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
                    {localizeText('Liên kết đang hoạt động')} · {activeLinks.length}
                </summary>
                <div className="mt-1 space-y-1">
                    {activeLinks.slice(0, visibleLinkCount).map(link => (
                        <div key={link.linkId} className="flex items-center justify-between gap-3 py-2 text-sm">
                            <span className="min-w-0 truncate">{link.displayName}</span>
                            <Button type="button" size="icon" variant="ghost" disabled={pendingAction !== null} onClick={() => setRevokeTarget(link)} aria-label={localizeText('Thu hồi lời mời')}>
                                <Trash2 className="size-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    {visibleLinkCount < activeLinks.length ? (
                        <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setVisibleLinkCount(count => count + INITIAL_VISIBLE_ITEMS)}>{localizeText('Xem thêm')}</Button>
                    ) : null}
                </div>
            </details> : null}

            <ConfirmDialog
                open={revokeTarget !== null}
                onOpenChange={open => { if (!open) setRevokeTarget(null); }}
                title={localizeText('Thu hồi lời mời?')}
                description={localizeText('Liên kết này sẽ ngừng hoạt động ngay lập tức.')}
                confirmLabel={localizeText('Thu hồi')}
                destructive
                loading={Boolean(revokeTarget && pendingAction === `revoke:${revokeTarget.linkId}`)}
                onConfirm={() => revokeTarget ? handleRevoke(revokeTarget) : undefined}
            />
        </section>
    );
}
