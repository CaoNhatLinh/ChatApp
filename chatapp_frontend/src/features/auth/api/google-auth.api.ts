import apiClient from '@/shared/api/apiClient';
import { toAuthResponse, type CanonicalAuthResponse } from './auth.api';
import type { AuthResponse } from '../types/auth.types';

interface ProviderCapabilitiesResponse {
  google: { enabled: boolean };
}

interface SignedInResponse {
  status: 'SIGNED_IN';
  session: CanonicalAuthResponse;
  suggestedDisplayName: null;
}

interface RegistrationRequiredResponse {
  status: 'REGISTRATION_REQUIRED';
  session: null;
  suggestedDisplayName: string;
}

export type GoogleExchangeResponse =
  | { status: 'SIGNED_IN'; session: AuthResponse }
  | { status: 'REGISTRATION_REQUIRED'; suggestedDisplayName: string };

type CanonicalGoogleExchangeResponse = SignedInResponse | RegistrationRequiredResponse;

export interface ConnectedIdentities {
  google: {
    linked: boolean;
    email: string | null;
  };
}

const parseExchangeResponse = (response: CanonicalGoogleExchangeResponse): GoogleExchangeResponse => {
  if (response.status === 'SIGNED_IN') {
    return { status: 'SIGNED_IN', session: toAuthResponse(response.session) };
  }
  return {
    status: 'REGISTRATION_REQUIRED',
    suggestedDisplayName: response.suggestedDisplayName,
  };
};

export const getAuthProviders = async (): Promise<ProviderCapabilitiesResponse> => {
  const response = await apiClient.get<ProviderCapabilitiesResponse>('/auth/providers');
  return response.data;
};

export const exchangeGoogleToken = async (idToken: string): Promise<GoogleExchangeResponse> => {
  const response = await apiClient.post<CanonicalGoogleExchangeResponse>(
    '/auth/google/exchange',
    { idToken },
  );
  return parseExchangeResponse(response.data);
};

export const registerWithGoogle = async (input: {
  idToken: string;
  username: string;
  displayName: string;
}): Promise<AuthResponse> => {
  const response = await apiClient.post<CanonicalGoogleExchangeResponse>(
    '/auth/google/register',
    input,
  );
  const result = parseExchangeResponse(response.data);
  if (result.status !== 'SIGNED_IN') {
    throw new Error('Google registration did not create a canonical session');
  }
  return result.session;
};

export const getConnectedIdentities = async (): Promise<ConnectedIdentities> => {
  const response = await apiClient.get<ConnectedIdentities>('/auth/identities');
  return response.data;
};

export const linkGoogleIdentity = async (input: {
  idToken: string;
  currentPassword: string;
}): Promise<ConnectedIdentities> => {
  const response = await apiClient.post<ConnectedIdentities>('/auth/identities/google', input);
  return response.data;
};
