// src/components/presence/StatusSelector.tsx
// Dropdown component for selecting user status (Online, DND, Invisible)

import { Circle, MinusCircle, EyeOff, Check } from 'lucide-react';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/shared/ui/DropdownMenu';
import { cn } from '@/shared/lib/cn';

type StatusValue = 'ONLINE' | 'DND' | 'INVISIBLE';

interface StatusOption {
    value: StatusValue;
    label: string;
    description: string;
    icon: React.ReactNode;
    dotColor: string; // Tailwind class for the dot indicator
}

const STATUS_OPTIONS: StatusOption[] = [
    {
        value: 'ONLINE',
        label: 'Trực tuyến',
        description: 'Mọi người thấy bạn đang hoạt động',
        icon: <Circle className="h-4 w-4 fill-green-500 text-green-500" />,
        dotColor: 'bg-green-500',
    },
    {
        value: 'DND',
        label: 'Không làm phiền',
        description: 'Tắt thông báo, hiện biểu tượng đỏ',
        icon: <MinusCircle className="h-4 w-4 fill-red-500 text-red-500" />,
        dotColor: 'bg-red-500',
    },
    {
        value: 'INVISIBLE',
        label: 'Vô hình',
        description: 'Mọi người thấy bạn đang ngoại tuyến',
        icon: <EyeOff className="h-4 w-4 text-gray-400" />,
        dotColor: 'bg-gray-400',
    },
];

interface StatusSelectorProps {
    className?: string;
    children?: React.ReactNode;
}

export const StatusSelector = ({ className, children }: StatusSelectorProps) => {
    const myStatus = usePresenceStore((s) => s.myStatus);
    const setMyStatus = usePresenceStore((s) => s.setMyStatus);

    const currentOption = STATUS_OPTIONS.find((opt) => opt.value === myStatus) ?? STATUS_OPTIONS[0];

    const handleStatusChange = (newStatus: StatusValue) => {
        if (newStatus === myStatus) return; // No change needed
        setMyStatus(newStatus);
        presenceWsService.setStatus(newStatus);
    };

    return (
        <DropdownMenu>
            {children ? (
                <DropdownMenuTrigger asChild>
                    {children}
                </DropdownMenuTrigger>
            ) : (
                <DropdownMenuTrigger
                    className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
                        'hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        'transition-colors',
                        className
                    )}
                >
                    {currentOption.icon}
                    <span className="hidden sm:inline">{currentOption.label}</span>
                </DropdownMenuTrigger>
            )}
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-2 z-50">
                <DropdownMenuLabel className="font-semibold px-2 py-1.5 text-sm text-foreground">Trạng thái hoạt động</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleStatusChange(option.value)}
                        className="flex items-center gap-3 cursor-pointer rounded-lg p-2"
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/50 flex items-center justify-center">
                            {option.icon}
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="font-semibold text-sm">{option.label}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight">{option.description}</span>
                        </div>
                        {myStatus === option.value && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

/**
 * Status indicator dot component for displaying other users' status.
 * Used in user avatars, conversation lists, etc.
 *
 * - ONLINE: green dot
 * - DND: red dot (MinusCircle)
 * - OFFLINE/INVISIBLE: gray dot or no dot
 */
interface StatusDotProps {
    status: string;
    isOnline: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const StatusDot = ({ status, isOnline, size = 'sm', className }: StatusDotProps) => {
    const sizeClasses = {
        sm: 'h-2.5 w-2.5',
        md: 'h-3 w-3',
        lg: 'h-3.5 w-3.5',
    };

    // Determine dot color and icon based on public status
    if (status === 'DND' && isOnline) {
        return (
            <span
                className={cn(
                    sizeClasses[size],
                    'rounded-full bg-background flex items-center justify-center',
                    className
                )}
            >
                <MinusCircle
                    className="w-full h-full fill-red-500 text-red-500"
                />
            </span>
        );
    }

    if (isOnline) {
        return (
            <span
                className={cn(
                    sizeClasses[size],
                    'rounded-full bg-green-500 inline-block',
                    className
                )}
            />
        );
    }

    // Offline (includes INVISIBLE users who appear offline to others)
    return (
        <span
            className={cn(
                sizeClasses[size],
                'rounded-full bg-gray-400 inline-block',
                className
            )}
        />
    );
};

export default StatusSelector;
