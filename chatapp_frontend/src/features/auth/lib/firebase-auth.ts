import type { Auth } from 'firebase/auth';
import { runtimeEnv } from '@/shared/config/runtimeEnv';

const firebaseConfig = runtimeEnv.firebase;

export const isFirebaseClientConfigured = Object.values(firebaseConfig).every(Boolean);

let authPromise: Promise<Auth> | undefined;

const getFirebaseAuth = (): Promise<Auth> => {
  if (!isFirebaseClientConfigured) {
    return Promise.reject(new Error('Firebase web configuration is incomplete'));
  }
  authPromise ??= initializeFirebaseAuth();
  return authPromise;
};

const initializeFirebaseAuth = async (): Promise<Auth> => {
  const [{ getApp, getApps, initializeApp }, { browserSessionPersistence, getAuth, setPersistence }] =
    await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await setPersistence(auth, browserSessionPersistence);
  return auth;
};

const googleProvider = async () => {
  const { GoogleAuthProvider } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const signInWithGooglePopup = async (): Promise<string> => {
  const [{ signInWithPopup }, auth, provider] = await Promise.all([
    import('firebase/auth'),
    getFirebaseAuth(),
    googleProvider(),
  ]);
  const result = await signInWithPopup(auth, provider);
  return result.user.getIdToken(true);
};

export const redirectToGoogleSignIn = async (): Promise<void> => {
  const [{ signInWithRedirect }, auth, provider] = await Promise.all([
    import('firebase/auth'),
    getFirebaseAuth(),
    googleProvider(),
  ]);
  await signInWithRedirect(auth, provider);
};

export const getGoogleRedirectToken = async (): Promise<string | null> => {
  const [{ getRedirectResult }, auth] = await Promise.all([
    import('firebase/auth'),
    getFirebaseAuth(),
  ]);
  const result = await getRedirectResult(auth);
  return result ? result.user.getIdToken(true) : null;
};

export const clearFirebaseSession = async (): Promise<void> => {
  if (!authPromise) return;
  const [{ signOut }, auth] = await Promise.all([import('firebase/auth'), authPromise]);
  await signOut(auth);
};
