import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

// Firebase Client Web Config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyDummyKeyForGoogleAuthPopup",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "codebase-xray.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "codebase-xray",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "codebase-xray.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abc123def456"
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
