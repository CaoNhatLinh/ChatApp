import * as React from 'react';
import type { ConversationChatMode } from '@/features/messenger/types/messenger.types';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { localizeText } from '@/shared/i18n';

interface RoomChatPolicyValue {
    chatMode: ConversationChatMode;
    slowModeSeconds: number;
}

interface RoomChatPolicyFormProps {
    initialValue: RoomChatPolicyValue;
    loading: boolean;
    disabled: boolean;
    onSubmit: (value: RoomChatPolicyValue) => void;
}

export function RoomChatPolicyForm({
    initialValue,
    loading,
    disabled,
    onSubmit,
}: RoomChatPolicyFormProps) {
    const [value, setValue] = React.useState(initialValue);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit(value);
    };

    return (
        <form className="space-y-3 rounded-xl border border-border/70 bg-muted/25 p-3" onSubmit={submit}>
            <div>
                <label htmlFor="room-chat-mode" className="text-xs font-semibold">{localizeText('Ai có thể gửi tin nhắn')}</label>
                <select
                    id="room-chat-mode"
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                    value={value.chatMode}
                    disabled={disabled}
                    onChange={(event) => setValue((current) => ({
                        ...current,
                        chatMode: event.target.value as ConversationChatMode,
                    }))}
                >
                    <option value="OPEN">{localizeText('Mọi thành viên')}</option>
                    <option value="READ_ONLY">{localizeText('Chỉ đọc; người quản lý vẫn có thể gửi')}</option>
                    <option value="MANAGERS_ONLY">{localizeText('Chỉ người quản lý')}</option>
                </select>
            </div>
            <div>
                <label htmlFor="room-slow-mode" className="text-xs font-semibold">{localizeText('Thời gian chờ giữa hai tin nhắn')}</label>
                <Input
                    id="room-slow-mode"
                    className="mt-1"
                    type="number"
                    min={0}
                    max={86400}
                    required
                    disabled={disabled}
                    value={value.slowModeSeconds}
                    onChange={(event) => setValue((current) => ({
                        ...current,
                        slowModeSeconds: Number(event.target.value),
                    }))}
                />
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{localizeText('Nhập số giây; dùng 0 để tắt chế độ chậm.')}</p>
            </div>
            <Button type="submit" size="sm" loading={loading} disabled={disabled}>
                {localizeText('Lưu chính sách chat')}
            </Button>
        </form>
    );
}
