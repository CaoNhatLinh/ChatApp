import * as React from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { localizeText } from '@/shared/i18n';

const ROOM_PERMISSIONS = [
    ['MESSAGE_SEND', 'Gửi tin nhắn'],
    ['MESSAGE_EDIT_OWN', 'Sửa tin nhắn của mình'],
    ['MESSAGE_DELETE_OWN', 'Xóa tin nhắn của mình'],
    ['MESSAGE_DELETE_ANY', 'Xóa mọi tin nhắn'],
    ['MESSAGE_PIN', 'Ghim tin nhắn'],
    ['POLL_CREATE', 'Tạo bình chọn'],
    ['POLL_MANAGE', 'Quản lý bình chọn'],
    ['MEMBER_INVITE', 'Mời thành viên'],
    ['MEMBER_KICK', 'Xóa thành viên'],
    ['MEMBER_BAN', 'Cấm thành viên'],
    ['MEMBER_MUTE', 'Tắt tiếng thành viên'],
    ['ROLE_CREATE', 'Tạo vai trò'],
    ['ROLE_UPDATE', 'Chỉnh sửa vai trò'],
    ['ROLE_DELETE', 'Xóa vai trò'],
    ['ROLE_ASSIGN', 'Gán vai trò'],
    ['ROOM_UPDATE', 'Chỉnh sửa phòng'],
    ['INVITE_MANAGE', 'Quản lý lời mời'],
    ['CALL_START', 'Bắt đầu cuộc gọi'],
    ['CALL_MODERATE', 'Điều phối cuộc gọi'],
    ['ROOM_AUDIT_READ', 'Xem nhật ký phòng'],
] as const;

export interface RoomRoleFormValue {
    displayName: string;
    roleCode: string;
    colorHex: string;
    permissionCodes: string[];
    isDefault: boolean;
    rolePosition: number;
}

interface RoomRoleFormProps {
    initialValue: RoomRoleFormValue;
    editableRoleCode: boolean;
    availablePermissions: string[];
    submitLabel: string;
    loading: boolean;
    disabled: boolean;
    onSubmit: (value: RoomRoleFormValue) => void;
    onCancel: () => void;
}

export function RoomRoleForm({
    initialValue,
    editableRoleCode,
    availablePermissions,
    submitLabel,
    loading,
    disabled,
    onSubmit,
    onCancel,
}: RoomRoleFormProps) {
    const [value, setValue] = React.useState(initialValue);

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        onSubmit({
            ...value,
            displayName: value.displayName.trim(),
            roleCode: value.roleCode.trim().toUpperCase(),
            colorHex: value.colorHex.toUpperCase(),
        });
    };

    return (
        <form className="space-y-3 rounded-xl bg-muted/35 p-3" onSubmit={submit}>
            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
                <Input
                    aria-label={localizeText('Tên vai trò')}
                    placeholder={localizeText('Tên vai trò')}
                    required
                    maxLength={64}
                    value={value.displayName}
                    onChange={(event) => setValue((current) => ({ ...current, displayName: event.target.value }))}
                />
                <input
                    type="color"
                    aria-label={localizeText('Màu vai trò')}
                    className="h-10 w-11 cursor-pointer rounded-lg border border-border bg-background p-1"
                    value={value.colorHex}
                    onChange={(event) => setValue((current) => ({ ...current, colorHex: event.target.value }))}
                />
            </div>
            {editableRoleCode ? (
                <Input
                    aria-label={localizeText('Mã vai trò')}
                    placeholder={localizeText('Mã vai trò, ví dụ MODERATOR')}
                    required
                    maxLength={32}
                    pattern="[A-Za-z][A-Za-z0-9_]{1,31}"
                    value={value.roleCode}
                    onChange={(event) => setValue((current) => ({ ...current, roleCode: event.target.value.toUpperCase() }))}
                />
            ) : (
                <p className="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                    {localizeText('Mã vai trò không thể thay đổi:')} <strong className="text-foreground">{value.roleCode}</strong>
                </p>
            )}
            <Input
                type="number"
                min={1}
                max={10000}
                required
                aria-label={localizeText('Độ ưu tiên vai trò')}
                value={value.rolePosition}
                onChange={(event) => setValue((current) => ({
                    ...current,
                    rolePosition: Number(event.target.value),
                }))}
            />
            <p className="-mt-2 text-[11px] leading-4 text-muted-foreground">
                {localizeText('Số lớn hơn hiển thị vai trò ở vị trí cao hơn.')}
            </p>
            <fieldset>
                <legend className="mb-2 text-xs font-semibold">{localizeText('Quyền của vai trò')}</legend>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border bg-background p-2">
                    {ROOM_PERMISSIONS.filter(([code]) => availablePermissions.includes(code)).map(([code, label]) => (
                        <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/60">
                            <input
                                type="checkbox"
                                checked={value.permissionCodes.includes(code)}
                                onChange={(event) => setValue((current) => ({
                                    ...current,
                                    permissionCodes: event.target.checked
                                        ? [...current.permissionCodes, code]
                                        : current.permissionCodes.filter((permission) => permission !== code),
                                }))}
                            />
                            {localizeText(label)}
                        </label>
                    ))}
                </div>
            </fieldset>
            <label className="flex items-start gap-2 text-xs leading-5">
                <input
                    type="checkbox"
                    className="mt-1"
                    checked={value.isDefault}
                    onChange={(event) => setValue((current) => ({ ...current, isDefault: event.target.checked }))}
                />
                <span><strong>{localizeText('Vai trò mặc định')}</strong><br />{localizeText('Tự động gán cho thành viên mới.')}</span>
            </label>
            <div className="flex flex-wrap gap-2">
                <Button type="submit" size="sm" loading={loading} disabled={disabled}>{submitLabel}</Button>
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onCancel}>{localizeText('Hủy')}</Button>
            </div>
        </form>
    );
}
