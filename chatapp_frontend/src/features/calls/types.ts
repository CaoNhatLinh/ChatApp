import type { CallEvent } from '@/features/messenger/types/messenger.types';

export type CallConnectionState =
  | 'incoming'
  | 'outgoing'
  | 'connecting'
  | 'connected'
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
  conversationId: string;
  callId: string;
  callType: 'VOICE' | 'VIDEO';
  peerUserId: string;
  peerDisplayName: string;
  direction: 'incoming' | 'outgoing';
  state: CallConnectionState;
  errorMessage?: string;
}

export interface CallControls {
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

export type CallEventPayload = CallEvent;
