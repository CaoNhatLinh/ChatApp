import * as React from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { localizeText } from '@/shared/i18n';

export interface RoomMemberPolicyValue {
    mutedUntil: string | null;
    messageIntervalSeconds: number | null;
    reason: string;
}

interface RoomMemberPolicyFormProps {
    initialMutedUntil: string | null;
    initialMessageIntervalSeconds: number | null;
    loading: boolean;
    disabled: boolean;
    onSubmit: (value: RoomMemberPolicyValue) => void;
}

const toLocalDateTime = (isoValue: string | null): string => {
    if (isoValue === null) return '';
    const date = new Date(isoValue);
    const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return localTime.toISOString().slice(0, 16);
};

const toIsoDateTime = (localValue: string): string | null => (
    localValue === '' ? null : new Date(localValue).toISOString()
);

export function RoomMemberPolicyForm({
    initialMutedUntil,
    initialMessageIntervalSeconds,
    loading,
    disabled,
    onSubmit,
}: RoomMemberPolicyFormProps) {
    const formId = React.useId();
    const [mutedUntil, setMutedUntil] = React.useState(() => toLocalDateTime(initialMutedUntil));
    const [messageInterval, setMessageInterval] = React.useState(
        initialMessageIntervalSeconds === null ? '' : String(initialMessageIntervalSeconds),
    );
    const [reason, setReason] = React.useState('');

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit({
            mutedUntil: toIsoDateTime(mutedUntil),
            messageIntervalSeconds: messageInterval === '' ? null : Number(messageInterval),
            reason: reason.trim(),
        });
    };

    return (
        <form className="space-y-3 rounded-xl border border-border/70 bg-background p-3" onSubmit={submit}>
            <div>
                <label htmlFor={`${formId}-muted-until`} className="text-xs font-semibold">{localizeText('Tắt tiếng đến')}</label>
                <Input
                    id={`${formId}-muted-until`}
                    className="mt-1"
                    type="datetime-local"
                    value={mutedUntil}
                    disabled={disabled}
                    onChange={(event) => setMutedUntil(event.target.value)}
                />
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{localizeText('Để trống để bỏ tắt tiếng.')}</p>
            </div>
            <div>
                <label htmlFor={`${formId}-message-interval`} className="text-xs font-semibold">{localizeText('Thời gian chờ riêng')}</label>
                <Input
                    id={`${formId}-message-interval`}
                    className="mt-1"
                    type="number"
                    min={0}
                    max={604800}
                    value={messageInterval}
                    disabled={disabled}
                    onChange={(event) => setMessageInterval(event.target.value)}
                />
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{localizeText('Để trống để dùng chính sách của phòng.')}</p>
            </div>
            <div>
                <label htmlFor={`${formId}-reason`} className="text-xs font-semibold">{localizeText('Lý do kiểm duyệt')}</label>
                <Input
                    id={`${formId}-reason`}
                    className="mt-1"
                    required
                    maxLength={500}
                    value={reason}
                    disabled={disabled}
                    onChange={(event) => setReason(event.target.value)}
                />
            </div>
            <Button type="submit" size="sm" loading={loading} disabled={disabled || !reason.trim()}>
                {localizeText('Lưu chính sách thành viên')}
            </Button>
        </form>
    );
}
