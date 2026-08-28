import { useEffect, useState } from 'react';
import { ArrowRight, Check, Clock3, Link2Off, ShieldCheck, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/features/auth/model/auth.store';
import { acceptInvite, declineInvite, previewInvite, type InvitePreview } from '@/features/messenger/api/invite.api';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { ShellFrame } from '@/route-pages/shared/layout/ShellFrame';
import PublicShellHeader from '@/route-pages/shared/layout/PublicShellHeader';
import { localizeText } from '@/shared/i18n';

const statusCopy: Record<string, string> = {
    INVALID: 'Liên kết mời không hợp lệ.',
    INACTIVE: 'Liên kết mời không còn hoạt động.',
    REVOKED: 'Người quản lý đã thu hồi liên kết này.',
    EXPIRED: 'Liên kết mời đã hết hạn.',
    LIMIT_REACHED: 'Liên kết mời đã đạt giới hạn người tham gia.',
};

interface JoinInvitePageProps {
    token: string;
}

export default function JoinInvitePage({ token }: JoinInvitePageProps) {
    const router = useRouter();
    const authToken = useAuthStore(state => state.token);
    const [preview, setPreview] = useState<InvitePreview | null>(null);
    const [result, setResult] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const localizedStatusCopy = Object.fromEntries(Object.entries(statusCopy).map(([key, value]) => [key, localizeText(value)]));

    useEffect(() => {
        let active = true;
        void previewInvite(token)
            .then(data => active && setPreview(data))
            .catch(() => active && setPreview({ status: 'INVALID' }))
            .finally(() => active && setLoading(false));
        return () => { active = false; };
    }, [token]);

    const requireLogin = () => {
        router.push(`/login?from=${encodeURIComponent(`/join/${token}`)}`);
    };

    const accept = async () => {
        if (!authToken) return requireLogin();
        setSubmitting(true);
        try {
            const response = await acceptInvite(token);
            setResult(response.status);
            if (['ACCEPTED', 'ALREADY_MEMBER'].includes(response.status) && response.conversationId) {
                router.replace(`/app?conversationId=${response.conversationId}`);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const decline = async () => {
        if (authToken) {
            setSubmitting(true);
            try {
                const response = await declineInvite(token);
                setResult(response.status);
            } finally {
                setSubmitting(false);
            }
        } else {
            setResult('DECLINED');
        }
    };

    if (loading) {
        return <ShellFrame ambient="subtle"><PublicShellHeader /><div className="grid min-h-[calc(100dvh-4rem)] place-items-center"><LoadingSpinner size="lg" /></div></ShellFrame>;
    }

    const unavailable = !preview || preview.status !== 'ACTIVE';
    const declined = result === 'DECLINED';
    const pending = result === 'PENDING';

    return (
        <ShellFrame ambient="subtle">
            <PublicShellHeader />
            <main className="layout-shell grid min-h-[calc(100dvh-4rem)] place-items-center py-12">
            <section className="w-full max-w-lg overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
                <div className="border-b border-border bg-accent/50 p-8">
                    <div className="brand-mark mb-6 h-14 w-14 rounded-[0.8rem]">
                        {unavailable ? <Link2Off /> : <Users />}
                    </div>
                    <p className="page-kicker mb-2">{localizeText('Lời mời tham gia')}</p>
                    <h1 className="text-3xl font-bold tracking-[-0.03em]">
                        {unavailable ? localizeText('Không thể sử dụng lời mời') : preview.conversationName || 'Conversation'}
                    </h1>
                    {!unavailable && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            {preview.conversationType === 'CHANNEL' ? localizeText('Kênh cộng đồng') : localizeText('Phòng trò chuyện')} / {preview.displayName}
                        </p>
                    )}
                </div>

                <div className="space-y-5 p-8">
                    {unavailable ? (
                            <p className="rounded-[var(--radius-md)] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                            {localizedStatusCopy[preview?.status ?? 'INVALID'] ?? localizedStatusCopy.INVALID}
                        </p>
                    ) : declined ? (
                        <div className="text-center">
                            <X className="mx-auto mb-3 text-muted-foreground" />
                            <p className="font-bold">{localizeText('Bạn đã từ chối lời mời.')}</p>
                        </div>
                    ) : pending ? (
                        <div className="text-center">
                            <Clock3 className="mx-auto mb-3 text-amber-500" />
                            <p className="font-bold">{localizeText('Yêu cầu đã được gửi tới quản lý phòng.')}</p>
                        </div>
                    ) : (
                        <>
                                <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-muted p-4 text-sm">
                                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                                <p className="text-muted-foreground">
                                    {preview.joinPolicy === 'REQUEST_APPROVAL'
                                        ? localizeText('Quản lý phòng sẽ duyệt yêu cầu trước khi bạn được tham gia.')
                                        : localizeText('Bạn sẽ được thêm vào phòng ngay sau khi chấp nhận.')}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button onClick={() => void decline()} disabled={submitting} className="focus-ring rounded-[var(--radius-md)] border border-border px-4 py-3 font-semibold hover:bg-muted disabled:opacity-50">
                                    {localizeText('Từ chối')}
                                </button>
                                <button onClick={() => void accept()} disabled={submitting} className="focus-ring flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-primary px-4 py-3 font-semibold text-primary-foreground hover:-translate-y-px disabled:opacity-50">
                                    {authToken ? localizeText('Chấp nhận') : localizeText('Đăng nhập')} <ArrowRight className="size-4" />
                                </button>
                            </div>
                        </>
                    )}

                    {(unavailable || declined || pending) && (
                        <button onClick={() => router.push('/')} className="focus-ring flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-border px-4 py-3 font-semibold hover:bg-muted">
                            <Check className="size-4" /> {localizeText('Về trang chủ')}
                        </button>
                    )}
                </div>
            </section>
            </main>
        </ShellFrame>
    );
}
