import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const getEnv = (key, fallback = '') => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return fallback;
};

// Firebase Client Web Config (tradeio-20a33 Project)
const firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', 'AIzaSyB3FIPhN8A9blCPDFPiJwRejBCM9FFTHA0'),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', 'tradeio-20a33.firebaseapp.com'),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', 'tradeio-20a33'),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', 'tradeio-20a33.appspot.com'),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', '388630394068'),
  appId: getEnv('VITE_FIREBASE_APP_ID', '1:388630394068:web:e8a7fbb54f584a320e3741')
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGooglePopup() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    return {
      success: true,
      user: {
        id: user.uid,
        name: user.displayName || 'Google User',
        email: user.email,
        photoURL: user.photoURL,
        tier: 'pro',
        provider: 'google'
      }
    };
  } catch (err) {
    console.warn('[Firebase Google Auth Warning]:', err.message);
    return {
      success: false,
      error: err.message
    };
  }
}
