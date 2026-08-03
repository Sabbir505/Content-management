import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";
import { auth } from "./firebase";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("https://www.googleapis.com/auth/youtube.readonly");

function ensureAuth() {
  if (!auth) throw new Error("Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
  return auth;
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const userCredential = await createUserWithEmailAndPassword(ensureAuth(), email, password);
  await updateProfile(userCredential.user, { displayName });
  return userCredential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(ensureAuth(), email, password);
  return userCredential.user;
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  const userCredential = await signInWithPopup(ensureAuth(), googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(userCredential);
  const accessToken = credential?.accessToken || "";
  return { user: userCredential.user, accessToken };
}

export async function logOut() {
  await signOut(ensureAuth());
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_access_token");
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  const a = auth;
  if (!a) {
    // Firebase not configured — immediately report no user and return no-op
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(a, callback);
}

export function getCurrentUser(): User | null {
  return auth?.currentUser ?? null;
}

export function getGoogleAccessToken(userCredential: UserCredential): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(userCredential);
  return credential?.accessToken || null;
}
