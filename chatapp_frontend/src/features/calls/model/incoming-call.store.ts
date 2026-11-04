import { create } from 'zustand';
import { hideIncomingCall, mergeIncomingCall, receiveIncomingCall, type IncomingCallItem } from './incoming-call-inbox';
import type { CallSnapshot } from './call-command-channel';

interface IncomingCallState {
  actorId: string | null;
  generation: number;
  items: IncomingCallItem[];
  setScope: (actorId: string | null, generation: number) => void;
  receive: (event: unknown, actorId: string, generation: number) => void;
  receiveSnapshot: (snapshot: CallSnapshot, actorId: string, generation: number) => void;
  hide: (conversationId: string, callId: string) => void;
  resetState: () => void;
}

/** Private ephemeral state only: deliberately no persistence middleware. */
export const useIncomingCallStore = create<IncomingCallState>((set) => ({
  actorId: null, generation: -1, items: [],
  setScope: (actorId, generation) => set(state => state.actorId === actorId && state.generation === generation
    ? state : { actorId, generation, items: [] }),
  receive: (event, actorId, generation) => set(state => {
    if (state.actorId !== actorId || state.generation !== generation) return state;
    const items = receiveIncomingCall(state.items, event, actorId);
    return items === state.items ? state : { items };
  }),
  receiveSnapshot: (snapshot, actorId, generation) => set(state => {
    if (state.actorId !== actorId || state.generation !== generation || snapshot.calleeId !== actorId) return state;
    const items = mergeIncomingCall(state.items, snapshot);
    return items === state.items ? state : { items };
  }),
  hide: (conversationId, callId) => set(state => ({ items: hideIncomingCall(state.items, conversationId, callId) })),
  resetState: () => set({ actorId: null, generation: -1, items: [] }),
}));
