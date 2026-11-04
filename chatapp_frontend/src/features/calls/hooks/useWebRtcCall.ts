import { useCallback, useEffect, useRef, useState } from 'react';
import { realtimeService } from '@/shared/websocket/realtime-service';
import { runtimeEnv } from '@/shared/config/runtimeEnv';
import type { CallEventPayload, CallSignal, CallControls, CallSession } from '../types';
import { localizeText } from '@/shared/i18n';
import { addConnectionListener } from '@/shared/websocket/websocketService';
import { CallCommandChannel, CallCommandError, parseCallSnapshot, terminalCall, type CallAction, type CallCommandBody, type CallSnapshot } from '../model/call-command-channel';
import { useActiveCallDiscovery } from './useActiveCallDiscovery';

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
    typeof value.occurredAt === 'string' &&
    Number.isFinite(Date.parse(value.occurredAt)) && isRecord(value.state) &&
    (value.action === 'STATE' || (value.action === 'SIGNAL' &&
      typeof value.actorId === 'string' && typeof value.targetUserId === 'string' && isRecord(value.signal)))
  );
};

const mediaErrorMessage = (error: unknown): string => {
  if (error instanceof CallCommandError) return localizeText(error.uncertain
    ? 'Chưa xác nhận được cuộc gọi. Thử lại sẽ dùng cùng mã gọi.'
    : 'Không thể tiếp tục cuộc gọi. Kiểm tra kết nối và quyền gọi.');
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
  const channelRef = useRef<CallCommandChannel | null>(null);
  const onSnapshotRef = useRef<(snapshot: CallSnapshot) => void>(() => undefined);
  const versionRef = useRef({ callId: '', version: 0 });
  const offeredRef = useRef<string | null>(null);
  const negotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldStartRef = useRef<CallSession | null>(null);
  const announcedRef = useRef<string | null>(null);
  const closedCallsRef = useRef(new Set<string>());

  const markClosed = useCallback((id: string) => {
    closedCallsRef.current.add(id);
    if (closedCallsRef.current.size > 64) closedCallsRef.current.delete(closedCallsRef.current.values().next().value ?? '');
    if (heldStartRef.current?.callId === id) heldStartRef.current = null;
  }, []);

  const sendCommand = useCallback((action: CallAction, active: CallSession, extra: Pick<CallCommandBody, 'callType' | 'signal'> = {}) => {
    const channel = channelRef.current;
    if (!channel) return Promise.reject(new CallCommandError('DISCONNECTED'));
    return channel.send(action, { conversationId: active.conversationId, callId: active.callId, targetUserId: active.peerUserId, ...extra })
      .then(snapshot => { onSnapshotRef.current(snapshot); return snapshot; });
  }, []);

  const setCurrentSession = useCallback((next: CallSession | null) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const isCurrentSession = useCallback((activeSession: CallSession) => (
    sessionRef.current?.callId === activeSession.callId && sessionRef.current.attemptId === activeSession.attemptId
  ), []);

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
    if (negotiationTimerRef.current !== null) clearTimeout(negotiationTimerRef.current);
    negotiationTimerRef.current = null;
    const peer = peerRef.current;
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.onconnectionstatechange = null;
      peer.close();
    }
    peerRef.current = null;
    offeredRef.current = null;
    pendingCandidatesRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    closePeer();
    stopMedia();
  }, [closePeer, stopMedia]);

  const publishLeave = useCallback((activeSession: CallSession | null) => {
    if (!activeSession || activeSession.state === 'detached' || activeSession.state === 'incoming') return;
    void sendCommand('LEAVE', activeSession).catch(() => undefined);
  }, [sendCommand]);

  const publishEnd = useCallback((activeSession: CallSession | null) => {
    if (!activeSession) return;
    void sendCommand('END', activeSession).catch(() => undefined);
  }, [sendCommand]);

  const failSession = useCallback((activeSession: CallSession, message: string) => {
    if (!isCurrentSession(activeSession)) return;
    closePeer();
    stopMedia();
    setCurrentSession({ ...activeSession, isEnding: false, state: activeSession.state === 'detached' ? 'detached' : 'error', errorMessage: message });
  }, [closePeer, isCurrentSession, setCurrentSession, stopMedia]);

  const handleSignalFailure = useCallback((active: CallSession, error: unknown) => {
    if (!isCurrentSession(active)) return;
    if (error instanceof CallCommandError && error.uncertain) {
      // An ICE/SDP acknowledgment can be lost while the media path still works.
      void sendCommand('SYNC', active).catch(failure => failSession(active, mediaErrorMessage(failure)));
    } else {
      failSession(active, mediaErrorMessage(error));
      if (!(error instanceof CallCommandError)) void sendCommand('FAIL', active).catch(() => undefined);
    }
  }, [failSession, isCurrentSession, sendCommand]);

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
      if (
        !event.candidate ||
        !realtimeService.isConnected() ||
        !isCurrentSession(activeSession) ||
        peerRef.current !== peer
      ) return;
      void sendCommand('SIGNAL', activeSession, { signal: { kind: 'ice', candidate: event.candidate.toJSON() } })
        .catch(error => handleSignalFailure(activeSession, error));
    };
    peer.ontrack = (event) => {
      if (!isCurrentSession(activeSession) || peerRef.current !== peer) return;
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
        if (current?.callId === activeSession.callId && peerRef.current === peer) {
          if (negotiationTimerRef.current !== null) clearTimeout(negotiationTimerRef.current);
          negotiationTimerRef.current = null;
          setCurrentSession({ ...current, state: 'connected' });
        }
      }
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        const current = sessionRef.current;
        if (
          current?.callId === activeSession.callId &&
          peerRef.current === peer &&
          current.state !== 'error'
        ) {
          failSession(current, localizeText('Kết nối media đã thất bại. Hãy thử gọi lại.'));
          void sendCommand('FAIL', current).catch(() => undefined);
        }
      }
    };
    peerRef.current = peer;
    return peer;
  }, [failSession, handleSignalFailure, isCurrentSession, sendCommand, setCurrentSession]);

  const applyAuthority = useCallback((snapshot: CallSnapshot) => {
    const current = sessionRef.current;
    if (!current || current.callId !== snapshot.callId || current.conversationId !== snapshot.conversationId) return;
    if (versionRef.current.callId === snapshot.callId && snapshot.version < versionRef.current.version) return;
    versionRef.current = { callId: snapshot.callId, version: snapshot.version };
    if (terminalCall(snapshot)) {
      markClosed(snapshot.callId); cleanup();
      if (current.state !== 'error') setCurrentSession(null);
      return;
    }
    if (snapshot.status !== 'ACCEPTED' || current.state === 'error' || current.state === 'detached') return;
    const peer = peerRef.current;
    if (current.direction === 'incoming' && !peer) { markClosed(snapshot.callId); setCurrentSession(null); return; }
    if (peer && peer.connectionState !== 'connected' && negotiationTimerRef.current === null) {
      negotiationTimerRef.current = setTimeout(() => {
        negotiationTimerRef.current = null;
        if (!isCurrentSession(current) || peerRef.current !== peer || peer.connectionState === 'connected') return;
        failSession(current, localizeText('Kết nối media đã thất bại. Hãy thử gọi lại.'));
        void sendCommand('FAIL', current).catch(() => undefined);
      }, 30000);
    }
    if (current.direction !== 'outgoing' || !peer || offeredRef.current === current.callId) return;
    offeredRef.current = current.callId;
    void (async () => {
      try {
        setCurrentSession({ ...current, state: 'connecting' });
        const offer = await peer.createOffer();
        if (!isCurrentSession(current) || peerRef.current !== peer) return;
        await peer.setLocalDescription(offer);
        if (!isCurrentSession(current) || peerRef.current !== peer) return;
        await sendCommand('SIGNAL', current, { signal: { kind: 'sdp', description: peer.localDescription } });
      } catch (error) { handleSignalFailure(current, error); }
    })();
  }, [cleanup, failSession, handleSignalFailure, isCurrentSession, markClosed, sendCommand, setCurrentSession]);

  const discoverCall = useCallback((snapshot: CallSnapshot) => {
    const current = sessionRef.current;
    if (current) { if (current.callId === snapshot.callId) applyAuthority(snapshot); return; }
    if (!currentUserId || !peerUserId || closedCallsRef.current.has(snapshot.callId)) return;
    const incoming = snapshot.status === 'RINGING' && snapshot.calleeId === currentUserId;
    setCurrentSession({ attemptId: crypto.randomUUID(), conversationId: snapshot.conversationId, callId: snapshot.callId,
      callType: snapshot.callType, peerUserId, peerDisplayName,
      direction: snapshot.callerId === currentUserId ? 'outgoing' : 'incoming', state: incoming ? 'incoming' : 'detached' });
    announcedRef.current = snapshot.callId;
    versionRef.current = { callId: snapshot.callId, version: snapshot.version };
  }, [applyAuthority, currentUserId, peerDisplayName, peerUserId, setCurrentSession]);
  const discovery = useActiveCallDiscovery(canCall && conversationId && currentUserId && peerUserId
    ? { conversationId, actorId: currentUserId, peerUserId } : null, discoverCall);

  useEffect(() => { onSnapshotRef.current = applyAuthority; }, [applyAuthority]);

  useEffect(() => {
    if (!currentUserId) return;
    setCurrentSession(null); closedCallsRef.current.clear(); versionRef.current = { callId: '', version: 0 };
    const channel = new CallCommandChannel(realtimeService, currentUserId);
    channelRef.current = channel;
    return () => {
      const active = sessionRef.current;
      if (active && active.state !== 'detached' && active.state !== 'incoming') void channel.send('LEAVE', { conversationId: active.conversationId, callId: active.callId, targetUserId: active.peerUserId }).catch(() => undefined);
      sessionRef.current = null; heldStartRef.current = null; announcedRef.current = null;
      channelRef.current = null; channel.close(); cleanup();
    };
  }, [cleanup, currentUserId, setCurrentSession]);

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
    if (!conversationId || !currentUserId || !peerUserId || !canCall || discovery.status !== 'ready') return;
    if (sessionRef.current && sessionRef.current.state !== 'error') return;
    const held = heldStartRef.current;
    if ((sessionRef.current?.direction === 'incoming' && sessionRef.current.state === 'error')
      || (held && (held.conversationId !== conversationId || held.peerUserId !== peerUserId || held.callType !== callType))) {
      const previous = sessionRef.current ?? held;
      if (previous) setCurrentSession({ ...previous, state: 'error', errorMessage: localizeText('Đóng lượt gọi trước rồi chọn kiểu gọi khác.') });
      return;
    }
    if (!realtimeService.isConnected()) {
      const rejectedSession: CallSession = {
        attemptId: crypto.randomUUID(),
        conversationId,
        callId: held?.callId ?? crypto.randomUUID(),
        callType,
        peerUserId,
        peerDisplayName,
        direction: 'outgoing',
        state: 'error',
        errorMessage: localizeText('Kết nối thời gian thực chưa sẵn sàng.'),
      };
      setCurrentSession(rejectedSession);
      return;
    }
    if (sessionRef.current?.state === 'error') {
      cleanup();
      setCurrentSession(null);
    }

    const nextSession: CallSession = {
      attemptId: crypto.randomUUID(),
      conversationId,
      callId: held?.callId ?? crypto.randomUUID(),
      callType,
      peerUserId,
      peerDisplayName,
      direction: 'outgoing',
      state: 'outgoing',
    };
    setCurrentSession(nextSession);
    heldStartRef.current = nextSession;

    try {
      const stream = await requestMedia(callType);
      if (!isCurrentSession(nextSession)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraEnabled(callType === 'VIDEO');
      createPeer(nextSession, stream);
      announcedRef.current = nextSession.callId;
      await sendCommand('START', nextSession, { callType });
    } catch (error) {
      failSession(nextSession, mediaErrorMessage(error));
      if (!(error instanceof CallCommandError) && announcedRef.current === nextSession.callId) {
        void sendCommand('FAIL', nextSession).catch(() => undefined);
      }
    }
  }, [canCall, cleanup, conversationId, createPeer, currentUserId, discovery.status, failSession, isCurrentSession, peerDisplayName, peerUserId, requestMedia, sendCommand, setCurrentSession]);

  const accept = useCallback(async () => {
    const incoming = sessionRef.current;
    if (!incoming || incoming.direction !== 'incoming' || incoming.state !== 'incoming') return;
    if (!realtimeService.isConnected()) {
      failSession(incoming, localizeText('Kết nối thời gian thực chưa sẵn sàng.'));
      return;
    }
    setCurrentSession({ ...incoming, state: 'connecting' });
    try {
      const stream = await requestMedia(incoming.callType);
      if (!isCurrentSession(incoming)) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraEnabled(incoming.callType === 'VIDEO');
      createPeer({ ...incoming, state: 'connecting' }, stream);
      await sendCommand('JOIN', incoming);
    } catch (error) {
      failSession(incoming, mediaErrorMessage(error));
      if (!(error instanceof CallCommandError)) void sendCommand('FAIL', incoming).catch(() => undefined);
    }
  }, [createPeer, failSession, isCurrentSession, requestMedia, sendCommand, setCurrentSession]);

  const decline = useCallback(() => {
    const incoming = sessionRef.current;
    if (!incoming || incoming.direction !== 'incoming') return;
    publishLeave(incoming);
    markClosed(incoming.callId);
    cleanup();
    setCurrentSession(null);
  }, [cleanup, markClosed, publishLeave, setCurrentSession]);

  const hangUp = useCallback(() => {
    const activeSession = sessionRef.current;
    if (activeSession?.state === 'detached') {
      if (activeSession.isEnding) return;
      setCurrentSession({ ...activeSession, isEnding: true, errorMessage: undefined });
      void sendCommand('END', activeSession).catch(error => failSession(activeSession, mediaErrorMessage(error)));
      return;
    }
    publishEnd(activeSession);
    if (activeSession) markClosed(activeSession.callId);
    cleanup();
    setCurrentSession(null);
  }, [cleanup, failSession, markClosed, publishEnd, sendCommand, setCurrentSession]);

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
    if (!conversationId || !currentUserId || !peerUserId || !canCall) return;
    return realtimeService.subscribe(CALL_DESTINATION(conversationId), (payload) => {
      if (!isCallEvent(payload)) return;
      const event = payload;
      if (
        event.conversationId !== conversationId ||
        (event.action === 'SIGNAL' && (
          (event.actorId !== currentUserId && event.actorId !== peerUserId) ||
          event.targetUserId !== (event.actorId === currentUserId ? peerUserId : currentUserId)))
      ) return;
      let snapshot: CallSnapshot;
      try { snapshot = parseCallSnapshot(event.state, { conversationId, callId: event.callId, targetUserId: peerUserId }, currentUserId); }
      catch { return; }
      if (event.action === 'SIGNAL' && snapshot.status !== 'ACCEPTED') return;
      const current = sessionRef.current;
      if (current?.callId === event.callId && versionRef.current.callId === event.callId && snapshot.version < versionRef.current.version) return;
      if (terminalCall(snapshot)) {
        applyAuthority(snapshot); markClosed(snapshot.callId); return;
      }
      if (closedCallsRef.current.has(event.callId)) return;
      if (event.action === 'STATE' && snapshot.status === 'RINGING' && !current && snapshot.calleeId === currentUserId) {
        const incoming: CallSession = {
          attemptId: crypto.randomUUID(),
          conversationId,
          callId: event.callId,
          callType: snapshot.callType,
          peerUserId,
          peerDisplayName,
          direction: 'incoming',
          state: 'incoming',
        };
        setCurrentSession(incoming);
        announcedRef.current = event.callId;
        applyAuthority(snapshot);
        return;
      }
      if (!current || current.callId !== event.callId) return;
      if (versionRef.current.callId === event.callId && snapshot.version < versionRef.current.version) return;
      applyAuthority(snapshot);
      const peer = peerRef.current;
      if (!peer || event.action !== 'SIGNAL' || event.actorId === currentUserId) return;
      const signal = parseCallSignal(event.signal);
      if (!signal) return;
      void (async () => {
        try {
          if (!isCurrentSession(current) || peerRef.current !== peer) return;
          if (signal.kind === 'ice') {
            if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
            else if (pendingCandidatesRef.current.length < 256) pendingCandidatesRef.current.push(signal.candidate);
            else throw new Error('Call ICE queue is full');
            return;
          }

          if (
            (current.direction === 'outgoing' && signal.description.type !== 'answer') ||
            (current.direction === 'incoming' && signal.description.type !== 'offer')
          ) return;
          await peer.setRemoteDescription(signal.description);
          if (!isCurrentSession(current) || peerRef.current !== peer) return;
          await flushCandidates(peer);
          if (!isCurrentSession(current) || peerRef.current !== peer) return;
          if (signal.description.type === 'offer' && current.direction === 'incoming') {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            if (!isCurrentSession(current) || peerRef.current !== peer) return;
            await sendCommand('SIGNAL', current, { signal: { kind: 'sdp', description: peer.localDescription } });
          }
        } catch (error) {
          handleSignalFailure(current, error);
        }
      })();
    });
  }, [applyAuthority, canCall, conversationId, currentUserId, flushCandidates, handleSignalFailure, isCurrentSession, markClosed, peerDisplayName, peerUserId, sendCommand, setCurrentSession]);

  useEffect(() => {
    let busy = false;
    const sync = () => {
      const active = sessionRef.current;
      if (!active || active.state === 'error' || announcedRef.current !== active.callId || !realtimeService.isConnected() || busy) return;
      busy = true;
      void sendCommand(active.state === 'incoming' || active.state === 'detached' ? 'SYNC' : 'HEARTBEAT', active)
        .catch(error => failSession(active, mediaErrorMessage(error))).finally(() => { busy = false; });
    };
    const unsubscribe = addConnectionListener(() => queueMicrotask(sync));
    const timer = setInterval(sync, 10000);
    return () => { clearInterval(timer); unsubscribe(); };
  }, [currentUserId, failSession, sendCommand]);

  useEffect(() => {
    const active = sessionRef.current;
    if (active && (active.conversationId !== conversationId || !canCall)) {
      publishLeave(active);
      if (active.state !== 'incoming' && active.state !== 'detached') markClosed(active.callId);
      cleanup();
      setCurrentSession(null);
    }
  }, [canCall, cleanup, conversationId, markClosed, publishLeave, setCurrentSession]);

  useEffect(() => () => {
    publishLeave(sessionRef.current);
    cleanup();
  }, [cleanup, publishLeave]);

  return {
    discovery,
    canStart: discovery.status === 'ready' && (!session || session.state === 'error'),
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
