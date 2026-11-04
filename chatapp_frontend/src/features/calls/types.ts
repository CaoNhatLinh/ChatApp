import type { CallSnapshot } from './model/call-command-channel';

export type CallConnectionState =
  | 'incoming'
  | 'outgoing'
  | 'connecting'
  | 'connected'
  | 'detached'
  | 'error';

export type CallSignal =
  | {
      kind: 'sdp';
      description: RTCSessionDescriptionInit;
    }
  | {
      kind: 'ice';
      candidate: RTCIceCandidateInit;
    };

export interface CallSession {
  attemptId: string;
  conversationId: string;
  callId: string;
  callType: 'VOICE' | 'VIDEO';
  peerUserId: string;
  peerDisplayName: string;
  direction: 'incoming' | 'outgoing';
  state: CallConnectionState;
  errorMessage?: string;
  isEnding?: boolean;
}

export interface CallControls {
  discovery: { status: 'idle' | 'loading' | 'ready' | 'error'; retry: () => void };
  canStart: boolean;
  session: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isCameraEnabled: boolean;
  start: (callType: 'VOICE' | 'VIDEO') => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

interface CallEventScope {
  conversationId: string;
  callId: string;
  occurredAt: string;
  state: CallSnapshot;
}

export type CallEventPayload =
  | (CallEventScope & { action: 'STATE' })
  | (CallEventScope & {
      action: 'SIGNAL'; actorId: string; targetUserId: string;
      signal: Record<string, unknown>;
    });
