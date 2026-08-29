import { Circle, MinusCircle, EyeOff, Check, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { usePresenceStore } from '@/features/presence/model/presence.store';
import { presenceWsService } from '@/features/presence/services/presenceWsService';
import { logger } from '@/shared/lib/logger';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/shared/ui/DropdownMenu';
import { cn } from '@/shared/lib/cn';
import { MESSENGER_COPY } from '@/features/messenger/constants/messengerCopy';
import { localizeText, useAppLocale } from '@/shared/i18n';

type StatusValue = 'ONLINE' | 'DND' | 'INVISIBLE';

interface StatusOption {
    value: StatusValue;
    label: string;
    description: string;
    icon: React.ReactNode;
}

const STATUS_OPTIONS: StatusOption[] = [
    {
        value: 'ONLINE',
        label: MESSENGER_COPY.presence.statusSelector.onlineLabel,
        description: MESSENGER_COPY.presence.statusSelector.onlineDescription,
        icon: <Circle className="h-4 w-4 fill-green-500 text-green-500" />,
    },
    {
        value: 'DND',
        label: MESSENGER_COPY.presence.statusSelector.dndLabel,
        description: MESSENGER_COPY.presence.statusSelector.dndDescription,
        icon: <MinusCircle className="h-4 w-4 fill-red-500 text-red-500" />,
    },
    {
        value: 'INVISIBLE',
        label: MESSENGER_COPY.presence.statusSelector.invisibleLabel,
        description: MESSENGER_COPY.presence.statusSelector.invisibleDescription,
        icon: <EyeOff className="h-4 w-4 text-gray-400" />,
    },
];

const getStatusOption = (status: StatusValue): StatusOption => {
    const option = STATUS_OPTIONS.find((candidate) => candidate.value === status);
    if (!option) throw new Error(`Unsupported own presence status: ${status}`);
    return option;
};

interface StatusSelectorProps {
    className?: string;
    children?: React.ReactNode;
}

export const StatusSelector = ({ className, children }: StatusSelectorProps) => {
    useAppLocale();
    const myStatus = usePresenceStore((s) => s.myStatus);
    const isUpdatingMyStatus = usePresenceStore((s) => s.isUpdatingMyStatus);
    const setMyStatus = usePresenceStore((s) => s.setMyStatus);
    const rollbackMyStatus = usePresenceStore((s) => s.rollbackMyStatus);
    const pendingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useEffect(() => {
        if (isUpdatingMyStatus) {
            return;
        }

        const currentTimeouts = pendingTimeoutsRef.current;
        currentTimeouts.forEach((timeout) => {
            clearTimeout(timeout);
        });
        currentTimeouts.clear();
    }, [isUpdatingMyStatus]);

    useEffect(() => {
        const currentTimeouts = pendingTimeoutsRef.current;
        return () => {
            currentTimeouts.forEach((timeout) => {
                clearTimeout(timeout);
            });
            currentTimeouts.clear();
        };
    }, []);

    const currentOption = getStatusOption(myStatus);

    const handleStatusChange = (newStatus: StatusValue) => {
        if (newStatus === myStatus || isUpdatingMyStatus) return; // No change needed

        const statusChange = presenceWsService.setStatus(newStatus);
        setMyStatus(newStatus, statusChange.requestId, statusChange.traceId);

        const existingTimeout = pendingTimeoutsRef.current.get(statusChange.requestId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
            pendingTimeoutsRef.current.delete(statusChange.requestId);
        }

        const rollbackTimeout = setTimeout(() => {
            const state = usePresenceStore.getState();
            if (
                state.isUpdatingMyStatus
                && state.pendingStatusRequestId === statusChange.requestId
                && state.myStatus === newStatus
            ) {
                logger.warn(`[Presence] STATUS_SYNC timeout, rolling back requestId=${statusChange.requestId}`);
                rollbackMyStatus(statusChange.requestId, statusChange.traceId);
            }
            pendingTimeoutsRef.current.delete(statusChange.requestId);
        }, 8000);

        pendingTimeoutsRef.current.set(statusChange.requestId, rollbackTimeout);
    };

    return (
        <DropdownMenu>
            {children ? (
                <DropdownMenuTrigger asChild>
                    {children}
                </DropdownMenuTrigger>
            ) : (
                <DropdownMenuTrigger
                    aria-label={localizeText(currentOption.label)}
                    title={localizeText(currentOption.label)}
                    className={cn(
                        'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm',
                        'hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isUpdatingMyStatus ? 'opacity-80' : '',
                        'transition-colors',
                        className
                    )}
                    disabled={isUpdatingMyStatus}
                >
                    {isUpdatingMyStatus ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        currentOption.icon
                    )}
                    <span className="hidden sm:inline">
                        {isUpdatingMyStatus
                          ? localizeText(MESSENGER_COPY.presence.statusSelector.updateLoading)
                          : localizeText(currentOption.label)}
                    </span>
                </DropdownMenuTrigger>
            )}
            <DropdownMenuContent align="end" className="w-64 rounded-xl p-2 z-50">
                <DropdownMenuLabel className="font-semibold px-2 py-1.5 text-sm text-foreground">{localizeText(MESSENGER_COPY.presence.statusSelector.title)}</DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {STATUS_OPTIONS.map((option) => (
                    <DropdownMenuItem
                        key={option.value}
                        disabled={isUpdatingMyStatus}
                        onClick={() => handleStatusChange(option.value)}
                        className="flex items-center gap-3 cursor-pointer rounded-lg p-2"
                    >
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/50 flex items-center justify-center">
                            {option.icon}
                        </div>
                        <div className="flex flex-col flex-1">
                            <span className="font-semibold text-sm">{localizeText(option.label)}</span>
                            <span className="text-[11px] text-muted-foreground leading-tight">{localizeText(option.description)}</span>
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
    title?: string;
}

export const StatusDot = ({
    status,
    isOnline,
    size = 'sm',
    className,
    title
}: StatusDotProps) => {
    const sizeClasses = {
        sm: 'h-2.5 w-2.5',
        md: 'h-3 w-3',
        lg: 'h-3.5 w-3.5',
    };

    const statusLabel = status === 'DND' && isOnline
        ? localizeText('Không làm phiền')
        : isOnline
            ? localizeText('Đang hoạt động')
            : localizeText('Ngoại tuyến');

    // Determine dot color and icon based on public status
    if (status === 'DND' && isOnline) {
    return (
            <span
                className={cn(
                    sizeClasses[size],
                    'rounded-full bg-background flex items-center justify-center',
                    className
                )}
                title={title}
                role="img"
                aria-label={title ?? statusLabel}
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
            title={title}
            role="img"
            aria-label={title ?? statusLabel}
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
            title={title}
            role="img"
            aria-label={title ?? statusLabel}
        />
    );
};

export default StatusSelector;
