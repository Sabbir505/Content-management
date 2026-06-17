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

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(userCredential.user, { displayName });
  return userCredential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function signInWithGoogle(): Promise<{ user: User; accessToken: string }> {
  const userCredential = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(userCredential);
  const accessToken = credential?.accessToken || "";
  return { user: userCredential.user, accessToken };
}

export async function logOut() {
  await signOut(auth);
  if (typeof window !== "undefined") {
    localStorage.removeItem("google_access_token");
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

export function getGoogleAccessToken(userCredential: UserCredential): string | null {
  const credential = GoogleAuthProvider.credentialFromResult(userCredential);
  return credential?.accessToken || null;
}
