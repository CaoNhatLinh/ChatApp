import { create } from 'zustand';
import { useMemo } from "react";
import { subscribeWithSelector } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type {
    PresencePreferenceStatus,
    NormalizedPresenceEvent,
    PublicPresenceStatus,
    UserPresence
} from '@/entities/presence/model/presence.types';
import { calculateTimeAgo } from '@/shared/lib/time';

type PresenceStatus = PublicPresenceStatus | PresencePreferenceStatus;

interface PresenceState {
    // Online users snapshot
    presences: Map<string, UserPresence>;

    // Own status preference
    myStatus: PresencePreferenceStatus;
    lastSyncedMyStatus: PresencePreferenceStatus;
    isUpdatingMyStatus: boolean;
    pendingStatusRequestId: string | null;
    pendingStatusDesired: PresencePreferenceStatus | null;
    pendingStatusTraceId: string | null;

    updateOnlineStatus: (event: NormalizedPresenceEvent) => void;
    setMyStatus: (status: PresencePreferenceStatus, requestId: string, traceId?: string | null) => void;
    setMyStatusFromServer: (status: PresencePreferenceStatus, requestId?: string | null, traceId?: string | null) => void;
    rollbackMyStatus: (requestId?: string | null, traceId?: string | null) => boolean;
    getPendingStatusRequestId: () => string | null;
    clearPresences: () => void;
}

const normalizeStatus = (rawStatus: string | undefined, online: boolean): PresenceStatus => {
    if (!online) {
        return 'OFFLINE';
    }
    if (rawStatus === 'DND') return 'DND';
    return rawStatus === 'ONLINE' || rawStatus === 'OFFLINE' ? rawStatus : 'ONLINE';
};

const toUserPresence = (userId: string, presence: UserPresence) => {
    const isOnline = Boolean(presence.isOnline);
    const status = normalizeStatus(presence.status, isOnline);
    return {
        ...presence,
        userId: presence.userId ?? userId,
        isOnline,
        status,
        lastSeen: presence.lastSeen ?? null,
        lastActiveAgo: presence.lastActiveAgo ?? null
    } as UserPresence;
};

export const usePresenceStore = create<PresenceState>()(
    subscribeWithSelector((set, get) => ({
        presences: new Map(),
        myStatus: 'ONLINE',
        lastSyncedMyStatus: 'ONLINE',
        isUpdatingMyStatus: false,
        pendingStatusRequestId: null,
        pendingStatusDesired: null,
        pendingStatusTraceId: null,

        updateOnlineStatus: (event) => {
            set((state) => {
                const existing = state.presences.get(event.userId);
                const isOnline = Boolean(event.online);
                const status = normalizeStatus(event.status, isOnline);
                const eventAgo = event.lastActiveAgo ?? calculateTimeAgo(event.timestamp);

                const resolvedLastSeen = isOnline
                    ? existing?.lastSeen ?? event.lastSeen ?? null
                    : event.lastSeen ?? existing?.lastSeen ?? null;

                const resolvedLastActiveAgo = isOnline
                    ? existing?.lastActiveAgo ?? eventAgo
                    : calculateTimeAgo(resolvedLastSeen);

                const next = new Map(state.presences);
                next.set(
                    event.userId,
                    toUserPresence(event.userId, {
                        ...(existing ?? {}),
                        userId: event.userId,
                        isOnline,
                        status,
                        lastSeen: resolvedLastSeen,
                        lastActiveAgo: resolvedLastActiveAgo,
                        device: event.device ?? existing?.device,
                    } as UserPresence)
                );
                return { presences: next };
            });
        },

        setMyStatus: (status, requestId, traceId = null) => {
            set({
                myStatus: status,
                pendingStatusRequestId: requestId,
                pendingStatusTraceId: traceId,
                pendingStatusDesired: status,
                isUpdatingMyStatus: true
            });
        },

        setMyStatusFromServer: (status, requestId = null, traceId = null) => {
            const activeRequestId = get().pendingStatusRequestId;
            const activeTraceId = get().pendingStatusTraceId;

            if (activeRequestId) {
                if (requestId) {
                    if (activeRequestId !== requestId) {
                        return;
                    }
                } else if (activeTraceId) {
                    // Ignore loose server updates when a pending request is still in-flight
                    // and no explicit request correlation id is provided.
                    return;
                }
            }

            if (activeTraceId) {
                if (traceId) {
                    if (activeTraceId !== traceId) {
                        return;
                    }
                } else if (activeRequestId) {
                    // Same reason as above: avoid orphaned updates clearing the wrong pending flow.
                    return;
                }
            }

            set({
                myStatus: status,
                lastSyncedMyStatus: status,
                isUpdatingMyStatus: false,
                pendingStatusRequestId: null,
                pendingStatusDesired: null,
                pendingStatusTraceId: null
            });
        },

        rollbackMyStatus: (requestId, traceId) => {
            let rolledBack = false;
            set((state) => {
                const activeRequestId = state.pendingStatusRequestId;
                const activeTraceId = state.pendingStatusTraceId;
                if (!activeRequestId) {
                    return state;
                }

                if (requestId && activeRequestId !== requestId) {
                    return state;
                }
                if (traceId && activeTraceId && activeTraceId !== traceId) {
                    return state;
                }

                rolledBack = true;
                return {
                    myStatus: state.lastSyncedMyStatus,
                    isUpdatingMyStatus: false,
                    pendingStatusRequestId: null,
                    pendingStatusDesired: null,
                    pendingStatusTraceId: null
                };
            });
            return rolledBack;
        },

        getPendingStatusRequestId: () => {
            return get().pendingStatusRequestId;
        },

        clearPresences: () => {
            set({
                presences: new Map(),
                myStatus: 'ONLINE',
                lastSyncedMyStatus: 'ONLINE',
                isUpdatingMyStatus: false,
                pendingStatusRequestId: null,
                pendingStatusDesired: null,
                pendingStatusTraceId: null
            });
        }
    }))
);

export const usePresence = (userId?: string) => {
    const presence = usePresenceStore((state) => (userId ? state.presences.get(userId) ?? null : null));

    return { presence };
};

export const usePresenceByUserIds = (userIds: string[]) => {
    const normalizedUserIds = useMemo(() => {
        const uniqueUserIds = new Set<string>();

        for (const userId of userIds) {
            if (userId) {
                uniqueUserIds.add(userId);
            }
        }

        return [...uniqueUserIds];
    }, [userIds]);

    return usePresenceStore(
        useShallow((state) => {
            const result = {} as Record<string, UserPresence | null>;
            for (const userId of normalizedUserIds) {
                result[userId] = state.presences.get(userId) ?? null;
            }
            return result;
        }),
    );
};
