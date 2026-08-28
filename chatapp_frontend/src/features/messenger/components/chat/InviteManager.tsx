import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, QrCode, Trash2, UserCheck, UserX } from 'lucide-react';
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
import { localizeText } from '@/shared/i18n';

export function InviteManager({ conversationId }: { conversationId: string }) {
    const [links, setLinks] = useState<InviteLinkRecord[]>([]);
    const [requests, setRequests] = useState<JoinRequestView[]>([]);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    const [kind, setKind] = useState<'LINK' | 'QR'>('LINK');
    const [policy, setPolicy] = useState<'DIRECT_JOIN' | 'REQUEST_APPROVAL'>('DIRECT_JOIN');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = async () => {
        const [nextLinks, nextRequests] = await Promise.all([
            listInvites(conversationId),
            listJoinRequests(conversationId),
        ]);
        setLinks(nextLinks);
        setRequests(nextRequests);
    };

    useEffect(() => {
        setError(null);
        void refresh().catch(() => setError(localizeText('Bạn không có quyền quản lý lời mời.')));
        // conversationId is the complete identity of this manager instance.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId]);

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
            await refresh();
        } catch {
            setError(localizeText('Không thể tạo lời mời. Hãy kiểm tra quyền của bạn.'));
        } finally {
            setBusy(false);
        }
    };

    if (error && links.length === 0) {
        return <p className="rounded-xl bg-destructive/5 p-3 text-xs text-destructive">{error}</p>;
    }

    return (
        <div className="space-y-4 rounded-2xl border border-border/50 p-3">
            <div className="flex gap-2">
                <button onClick={() => setKind('LINK')} className={`flex-1 rounded-lg p-2 text-xs font-bold ${kind === 'LINK' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}><Link2 className="mx-auto mb-1 size-4" />Link</button>
                <button onClick={() => setKind('QR')} className={`flex-1 rounded-lg p-2 text-xs font-bold ${kind === 'QR' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}><QrCode className="mx-auto mb-1 size-4" />QR</button>
            </div>
            <select value={policy} onChange={event => setPolicy(event.target.value as typeof policy)} className="w-full rounded-lg border border-border bg-background p-2 text-xs">
                <option value="DIRECT_JOIN">{localizeText('Tham gia ngay')}</option>
                <option value="REQUEST_APPROVAL">{localizeText('Cần quản lý duyệt')}</option>
            </select>
            <button onClick={() => void makeInvite()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary p-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} {localizeText('Tạo lời mời 7 ngày')}
            </button>

            {selectedUrl && (
                <div className="space-y-3 rounded-xl bg-white p-4 text-center text-black">
                    {kind === 'QR' && <QRCodeSVG value={selectedUrl} size={160} level="H" className="mx-auto" />}
                    <p className="break-all text-[10px]">{selectedUrl}</p>
                    <button onClick={() => void navigator.clipboard.writeText(selectedUrl)} className="mx-auto flex items-center gap-1 text-xs font-bold"><Copy className="size-3" /> {localizeText('Sao chép')}</button>
                </div>
            )}

            {links.filter(link => link.isActive).slice(0, 5).map(link => (
                <div key={link.linkId} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 p-2 text-[10px]">
                    <span className="truncate">{link.displayName} · {link.usedCount}/{link.maxUses ?? '∞'}</span>
                    <button onClick={() => void revokeInvite(link.linkToken).then(refresh)} title={localizeText('Thu hồi')}><Trash2 className="size-3 text-destructive" /></button>
                </div>
            ))}

            {requests.filter(request => request.status === 'PENDING').map(request => (
                <div key={request.requestId} className="rounded-lg border border-border/50 p-2 text-[10px]">
                    <p className="mb-2 truncate font-bold">User {request.userId}</p>
                    <div className="flex gap-2">
                        <button onClick={() => void resolveJoinRequest(request, 'APPROVE').then(refresh)} className="flex flex-1 items-center justify-center gap-1 rounded bg-emerald-500/10 p-1 text-emerald-600"><UserCheck className="size-3" />{localizeText('Duyệt')}</button>
                        <button onClick={() => void resolveJoinRequest(request, 'DECLINE').then(refresh)} className="flex flex-1 items-center justify-center gap-1 rounded bg-destructive/10 p-1 text-destructive"><UserX className="size-3" />{localizeText('Từ chối')}</button>
                    </div>
                </div>
            ))}
        </div>
    );
}
