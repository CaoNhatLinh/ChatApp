import { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { SurfacePanel } from '@/shared/ui/SurfacePanel';
import type { CallControls } from '@/features/calls/types';
import { localizeText, useAppLocale } from '@/shared/i18n';

interface CallSessionPanelProps {
  controls: CallControls;
}

const stateLabel: Record<NonNullable<CallControls['session']>['state'], string> = {
  incoming: 'Cuộc gọi đến',
  outgoing: 'Đang gọi',
  connecting: 'Đang kết nối media',
  connected: 'Đang kết nối',
  error: 'Cuộc gọi gặp lỗi',
};

const CallStream = ({
  stream,
  label,
  muted,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) {
      void video.play().catch(() => undefined);
    }
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className="h-28 w-40 rounded-2xl border border-border/60 bg-foreground object-cover shadow-sm"
    />
  );
};

export const CallSessionPanel = ({ controls }: CallSessionPanelProps) => {
  useAppLocale();
  const { session } = controls;
  if (!session) return null;

  const isIncoming = session.direction === 'incoming' && session.state === 'incoming';
  const isVideo = session.callType === 'VIDEO';
  const isError = session.state === 'error';

  return (
    <SurfacePanel role="status" aria-live="polite" className="mx-4 mt-3 overflow-hidden border-primary/20 bg-primary/[0.06]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
            {localizeText(isVideo ? 'Video call' : 'Voice call')} · {localizeText(stateLabel[session.state])}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {isIncoming ? `${session.peerDisplayName} ${localizeText('đang gọi cho bạn')}` : session.peerDisplayName}
          </p>
          {session.errorMessage ? (
            <p className="mt-1 text-xs text-destructive">{localizeText(session.errorMessage)}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {localizeText(isIncoming ? 'Chấp nhận để mở kết nối trực tiếp.' : 'Kết nối trực tiếp giữa hai thiết bị.')}
            </p>
          )}
        </div>

        {isVideo && !isError ? (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <CallStream stream={controls.remoteStream} label={localizeText('Video của người đối thoại')} />
            <CallStream stream={controls.localStream} label={localizeText('Video của bạn')} muted />
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          {isIncoming ? (
            <>
              <Button type="button" size="sm" onClick={() => void controls.accept()}>
                <Phone size={16} />
                {localizeText('Nhận cuộc gọi')}
              </Button>
              <Button type="button" size="icon" variant="outline" onClick={controls.decline} aria-label={localizeText('Từ chối cuộc gọi')} title={localizeText('Từ chối cuộc gọi')}>
                <X size={16} />
              </Button>
            </>
          ) : isError ? (
            <Button type="button" size="sm" variant="outline" onClick={controls.hangUp}>
              {localizeText('Đóng')}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                size="icon"
                variant={controls.isMuted ? 'default' : 'outline'}
                onClick={controls.toggleMute}
                aria-label={localizeText(controls.isMuted ? 'Bật microphone' : 'Tắt microphone')}
                title={localizeText(controls.isMuted ? 'Bật microphone' : 'Tắt microphone')}
              >
                {controls.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>
              {isVideo ? (
                <Button
                  type="button"
                  size="icon"
                  variant={controls.isCameraEnabled ? 'outline' : 'default'}
                  onClick={controls.toggleCamera}
                  aria-label={localizeText(controls.isCameraEnabled ? 'Tắt camera' : 'Bật camera')}
                  title={localizeText(controls.isCameraEnabled ? 'Tắt camera' : 'Bật camera')}
                >
                  {controls.isCameraEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                </Button>
              ) : null}
              <Button type="button" size="icon" variant="destructive" onClick={controls.hangUp} aria-label={localizeText('Kết thúc cuộc gọi')} title={localizeText('Kết thúc cuộc gọi')}>
                <PhoneOff size={16} />
              </Button>
            </>
          )}
        </div>
      </div>
    </SurfacePanel>
  );
};

export default CallSessionPanel;
