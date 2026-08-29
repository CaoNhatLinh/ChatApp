import { useCallback, useEffect, useRef, useState } from 'react';
import { realtimeService } from '@/shared/websocket/realtime-service';
import { runtimeEnv } from '@/shared/config/runtimeEnv';
import type { CallEventPayload, CallSignal, CallControls, CallSession } from '../types';
import { localizeText } from '@/shared/i18n';

const CALL_DESTINATION = (conversationId: string) => `/topic/conversation/${conversationId}/calls`;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const parseIceServers = (): RTCIceServer[] => {
  const raw = runtimeEnv.webRtcIceServers.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(localizeText('Cấu hình ICE server phải là JSON hợp lệ.'));
  }

  if (!Array.isArray(parsed)) {
    throw new Error(localizeText('Cấu hình ICE server phải là một mảng JSON.'));
  }

  return parsed.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error(localizeText('Mỗi ICE server phải là một object.'));
    }
    const urls = entry.urls;
    if (
      (typeof urls === 'string' && urls.trim().length === 0) ||
      (Array.isArray(urls) && (urls.length === 0 || !urls.every((url) => typeof url === 'string' && url.trim().length > 0))) ||
      (typeof urls !== 'string' && !Array.isArray(urls))
    ) {
      throw new Error(localizeText('ICE server phải có urls dạng chuỗi hoặc mảng chuỗi.'));
    }
    const server: RTCIceServer = { urls };
    if (entry.username !== undefined && typeof entry.username !== 'string') {
      throw new Error(localizeText('ICE server username phải là chuỗi.'));
    }
    if (entry.credential !== undefined && typeof entry.credential !== 'string') {
      throw new Error(localizeText('ICE server credential phải là chuỗi.'));
    }
    if (typeof entry.username === 'string') server.username = entry.username;
    if (typeof entry.credential === 'string') server.credential = entry.credential;
    return server;
  });
};

const parseCallSignal = (value: Record<string, unknown> | undefined): CallSignal | null => {
  if (!value || typeof value.kind !== 'string') return null;

  if (value.kind === 'sdp' && isRecord(value.description) && typeof value.description.type === 'string') {
    const type = value.description.type;
    if (type !== 'offer' && type !== 'answer' && type !== 'rollback' && type !== 'pranswer') return null;
    if (type !== 'rollback' && typeof value.description.sdp !== 'string') return null;
    return { kind: 'sdp', description: value.description as unknown as RTCSessionDescriptionInit };
  }

  if (value.kind === 'ice' && isRecord(value.candidate) && typeof value.candidate.candidate === 'string') {
    return { kind: 'ice', candidate: value.candidate as RTCIceCandidateInit };
  }

  return null;
};

const isCallEvent = (value: unknown): value is CallEventPayload => {
  if (!isRecord(value)) return false;
  return (
    typeof value.conversationId === 'string' &&
    typeof value.callId === 'string' &&
    typeof value.actorId === 'string' &&
    typeof value.occurredAt === 'string' &&
    (value.action === 'START' || value.action === 'JOIN' || value.action === 'LEAVE' || value.action === 'SIGNAL' || value.action === 'END') &&
    (value.callType === undefined || value.callType === 'VOICE' || value.callType === 'VIDEO') &&
    typeof value.targetUserId === 'string' &&
    (value.signal === undefined || isRecord(value.signal))
  );
};

const mediaErrorMessage = (error: unknown): string => {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return localizeText('Trình duyệt chưa cấp quyền camera hoặc microphone.');
    }
    if (error.name === 'NotFoundError') {
      return localizeText('Không tìm thấy camera hoặc microphone trên thiết bị.');
    }
    if (error.name === 'NotReadableError') {
      return localizeText('Camera hoặc microphone đang được ứng dụng khác sử dụng.');
    }
  }
  return localizeText('Không thể khởi tạo cuộc gọi.');
};

interface UseWebRtcCallOptions {
  conversationId: string | null;
  currentUserId?: string;
  peerUserId?: string;
  peerDisplayName: string;
  canCall: boolean;
}

export const useWebRtcCall = ({
  conversationId,
  currentUserId,
  peerUserId,
  peerDisplayName,
  canCall,
}: UseWebRtcCallOptions): CallControls => {
  const [session, setSession] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);

  const sessionRef = useRef<CallSession | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const setCurrentSession = useCallback((next: CallSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const stopMedia = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
  }, []);

  const closePeer = useCallback(() => {
    const peer = peerRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    peerRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    closePeer();
    stopMedia();
  }, [closePeer, stopMedia]);

  const publishLeave = useCallback((activeSession: CallSession | null) => {
    if (!activeSession || !realtimeService.isConnected()) return;
    realtimeService.publish('/app/call.leave', {
      conversationId: activeSession.conversationId,
      callId: activeSession.callId,
      targetUserId: activeSession.peerUserId,
    });
  }, []);

  const publishEnd = useCallback((activeSession: CallSession | null) => {
    if (!activeSession || !realtimeService.isConnected()) return;
    realtimeService.publish('/app/call.end', {
      conversationId: activeSession.conversationId,
      callId: activeSession.callId,
      targetUserId: activeSession.peerUserId,
    });
  }, []);

  const failSession = useCallback((activeSession: CallSession, message: string) => {
    closePeer();
    stopMedia();
    setCurrentSession({ ...activeSession, state: 'error', errorMessage: message });
  }, [closePeer, setCurrentSession, stopMedia]);

  const flushCandidates = useCallback(async (peer: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const candidate of pending) {
      await peer.addIceCandidate(candidate);
    }
  }, []);

  const createPeer = useCallback((activeSession: CallSession, stream: MediaStream) => {
    if (typeof RTCPeerConnection === 'undefined') {
      throw new Error(localizeText('Trình duyệt hiện tại không hỗ trợ kết nối media.'));
    }
    const peer = new RTCPeerConnection({ iceServers: parseIceServers() });
    stream.getTracks().forEach((track) => peer.addTrack(track, stream));
    peer.onicecandidate = (event) => {
      if (!event.candidate || !realtimeService.isConnected()) return;
      realtimeService.publish('/app/call.signal', {
        conversationId: activeSession.conversationId,
        callId: activeSession.callId,
        targetUserId: activeSession.peerUserId,
        signal: { kind: 'ice', candidate: event.candidate.toJSON() },
      });
    };
    peer.ontrack = (event) => {
      const [streamFromEvent] = event.streams;
      if (streamFromEvent) {
        remoteStreamRef.current = streamFromEvent;
        setRemoteStream(streamFromEvent);
        return;
      }
      const nextStream = remoteStreamRef.current ?? new MediaStream();
      nextStream.addTrack(event.track);
      remoteStreamRef.current = nextStream;
      setRemoteStream(nextStream);
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        const current = sessionRef.current;
        if (current?.callId === activeSession.callId) {
          setCurrentSession({ ...current, state: 'connected' });
        }
      }
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        const current = sessionRef.current;
        if (current?.callId === activeSession.callId && current.state !== 'error') {
          failSession(current, 'Kết nối media đã thất bại. Hãy thử gọi lại.');
        }
      }
    };
    peerRef.current = peer;
    return peer;
  }, [failSession, setCurrentSession]);

  const requestMedia = useCallback(async (callType: 'VOICE' | 'VIDEO') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(localizeText('Trình duyệt hiện tại không hỗ trợ camera hoặc microphone.'));
    }
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'VIDEO',
    });
  }, []);

  const start = useCallback(async (callType: 'VOICE' | 'VIDEO') => {
    if (!conversationId || !currentUserId || !peerUserId || !canCall) return;
    if (!realtimeService.isConnected()) {
      const rejectedSession: CallSession = {
        conversationId,
        callId: crypto.randomUUID(),
        callType,
        peerUserId,
        peerDisplayName,
        direction: 'outgoing',
        state: 'error',
        errorMessage: 'Kết nối thời gian thực chưa sẵn sàng.',
      };
      setCurrentSession(rejectedSession);
      return;
    }
    if (sessionRef.current && sessionRef.current.state !== 'error') return;
    if (sessionRef.current?.state === 'error') {
      cleanup();
      setCurrentSession(null);
    }

    const nextSession: CallSession = {
      conversationId,
      callId: crypto.randomUUID(),
      callType,
      peerUserId,
      peerDisplayName,
      direction: 'outgoing',
      state: 'outgoing',
    };
    setCurrentSession(nextSession);

    try {
      const stream = await requestMedia(callType);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraEnabled(callType === 'VIDEO');
      createPeer(nextSession, stream);
      realtimeService.publish('/app/call.start', {
        conversationId,
        callId: nextSession.callId,
        callType,
        maxParticipants: 2,
        targetUserId: peerUserId,
      });
    } catch (error) {
      failSession(nextSession, mediaErrorMessage(error));
    }
  }, [canCall, cleanup, conversationId, createPeer, currentUserId, failSession, peerDisplayName, peerUserId, requestMedia, setCurrentSession]);

  const accept = useCallback(async () => {
    const incoming = sessionRef.current;
    if (!incoming || incoming.direction !== 'incoming' || incoming.state !== 'incoming') return;
    if (!realtimeService.isConnected()) {
      failSession(incoming, 'Kết nối thời gian thực chưa sẵn sàng.');
      return;
    }
    try {
      const stream = await requestMedia(incoming.callType);
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraEnabled(incoming.callType === 'VIDEO');
      createPeer({ ...incoming, state: 'connecting' }, stream);
      setCurrentSession({ ...incoming, state: 'connecting' });
      realtimeService.publish('/app/call.join', {
        conversationId: incoming.conversationId,
        callId: incoming.callId,
        callType: incoming.callType,
        targetUserId: incoming.peerUserId,
      });
    } catch (error) {
      failSession(incoming, mediaErrorMessage(error));
    }
  }, [createPeer, failSession, requestMedia, setCurrentSession]);

  const decline = useCallback(() => {
    const incoming = sessionRef.current;
    if (!incoming || incoming.direction !== 'incoming') return;
    publishLeave(incoming);
    cleanup();
    setCurrentSession(null);
  }, [cleanup, publishLeave, setCurrentSession]);

  const hangUp = useCallback(() => {
    const activeSession = sessionRef.current;
    publishEnd(activeSession);
    cleanup();
    setCurrentSession(null);
  }, [cleanup, publishEnd, setCurrentSession]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((track) => { track.enabled = !nextMuted; });
    setIsMuted(nextMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream || sessionRef.current?.callType !== 'VIDEO') return;
    const nextEnabled = !isCameraEnabled;
    stream.getVideoTracks().forEach((track) => { track.enabled = nextEnabled; });
    setIsCameraEnabled(nextEnabled);
  }, [isCameraEnabled]);

  useEffect(() => {
    if (!conversationId || !currentUserId || !canCall) return;
    return realtimeService.subscribe(CALL_DESTINATION(conversationId), (payload) => {
      if (!isCallEvent(payload)) return;
      const event = payload;
      if (
        event.conversationId !== conversationId ||
        event.actorId === currentUserId ||
        event.targetUserId !== currentUserId
      ) return;

      const current = sessionRef.current;
      if (event.action === 'START') {
        if (!event.callType || (current && current.state !== 'error')) return;
        const incoming: CallSession = {
          conversationId,
          callId: event.callId,
          callType: event.callType,
          peerUserId: event.actorId,
          peerDisplayName,
          direction: 'incoming',
          state: 'incoming',
        };
        setCurrentSession(incoming);
        return;
      }

      if (!current || current.callId !== event.callId || current.peerUserId !== event.actorId) return;
      if (event.action === 'END' || event.action === 'LEAVE') {
        cleanup();
        setCurrentSession(null);
        return;
      }

      const peer = peerRef.current;
      if (!peer) return;

      if (event.action === 'JOIN' && current.direction === 'outgoing') {
        void (async () => {
          try {
            setCurrentSession({ ...current, state: 'connecting' });
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            realtimeService.publish('/app/call.signal', {
              conversationId,
              callId: current.callId,
              targetUserId: current.peerUserId,
              signal: { kind: 'sdp', description: peer.localDescription },
            });
          } catch (error) {
            failSession(current, mediaErrorMessage(error));
          }
        })();
        return;
      }

      if (event.action !== 'SIGNAL') return;
      const signal = parseCallSignal(event.signal);
      if (!signal) return;
      void (async () => {
        try {
          if (signal.kind === 'ice') {
            if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
            else pendingCandidatesRef.current.push(signal.candidate);
            return;
          }

          if (
            (current.direction === 'outgoing' && signal.description.type !== 'answer') ||
            (current.direction === 'incoming' && signal.description.type !== 'offer')
          ) return;
          await peer.setRemoteDescription(signal.description);
          await flushCandidates(peer);
          if (signal.description.type === 'offer' && current.direction === 'incoming') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            realtimeService.publish('/app/call.signal', {
              conversationId,
              callId: current.callId,
              targetUserId: current.peerUserId,
              signal: { kind: 'sdp', description: peer.localDescription },
            });
          }
        } catch (error) {
          failSession(current, mediaErrorMessage(error));
        }
      })();
    });
  }, [canCall, cleanup, conversationId, currentUserId, failSession, flushCandidates, peerDisplayName, setCurrentSession]);

  useEffect(() => {
    const active = sessionRef.current;
    if (active && active.conversationId !== conversationId) {
      publishLeave(active);
      cleanup();
      setCurrentSession(null);
    }
  }, [cleanup, conversationId, publishLeave, setCurrentSession]);

  useEffect(() => () => {
    publishLeave(sessionRef.current);
    cleanup();
  }, [cleanup, publishLeave]);

  return {
    session,
    localStream,
    remoteStream,
    isMuted,
    isCameraEnabled,
    start,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleCamera,
  };
};
