const requiredPublicUrl = (name: 'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_WS_URL', rawValue: string | undefined): string => {
  const value = rawValue?.trim();
  if (!value) {
    throw new Error(`${name} must be configured before the frontend starts`);
  }
  return value;
};

export const runtimeEnv = {
  apiBaseUrl: requiredPublicUrl('NEXT_PUBLIC_API_URL', process.env.NEXT_PUBLIC_API_URL),
  websocketUrl: requiredPublicUrl('NEXT_PUBLIC_WS_URL', process.env.NEXT_PUBLIC_WS_URL),
  webRtcIceServers: process.env.NEXT_PUBLIC_WEBRTC_ICE_SERVERS?.trim() ?? '',
  isDevelopment: process.env.NODE_ENV !== 'production',
};
