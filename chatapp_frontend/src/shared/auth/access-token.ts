let accessToken: string | undefined;
let sessionGeneration = 0;
const SESSION_HINT_COOKIE = 'novachat_session';

export class SessionChangedError extends Error {
  constructor() {
    super('The session changed while the request was running');
    this.name = 'SessionChangedError';
  }
}

export const getSessionGeneration = (): number => sessionGeneration;

export const getAccessToken = (): string | undefined => accessToken;

export const setAccessToken = (token: string): void => {
  if (!token.trim()) {
    throw new Error('Access token must not be empty');
  }
  accessToken = token;
};

export const clearAccessToken = (): void => {
  sessionGeneration += 1;
  accessToken = undefined;
};

export const hasSessionHint = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((cookie) => cookie === `${SESSION_HINT_COOKIE}=1`);
};

export const clearSessionHint = (): void => {
  if (typeof document !== 'undefined') {
    document.cookie = `${SESSION_HINT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
};
