import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

function hasValidConfig(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

let appInstance: FirebaseApp | null = null;

function getFirebaseApp(): FirebaseApp | null {
  if (appInstance) return appInstance;
  if (getApps().length > 0) {
    appInstance = getApp();
    return appInstance;
  }
  if (!hasValidConfig()) {
    // Running without Firebase config (e.g. open-source contributors, CI).
    // Return null so consumers can degrade gracefully.
    return null;
  }
  appInstance = initializeApp(firebaseConfig);
  return appInstance;
}

const app = getFirebaseApp();

// Lazy getters that return null when Firebase isn't configured.
// This lets the app build and run without env vars, degrading auth/db
// features gracefully instead of crashing at module load.
function getAuthSafe(): Auth | null {
  if (!app) return null;
  try {
    return getAuth(app);
  } catch {
    return null;
  }
}

function getDbSafe(): Firestore | null {
  if (!app) return null;
  try {
    const db = getFirestore(app);
    return db;
  } catch {
    return null;
  }
}

function getStorageSafe(): FirebaseStorage | null {
  if (!app) return null;
  try {
    return getStorage(app);
  } catch {
    return null;
  }
}

export const auth = getAuthSafe();
export const db = getDbSafe() as Firestore;
export const storage = getStorageSafe();

// Enable offline persistence so the app works when Firestore backend is unreachable
// (e.g. behind restrictive networks). Data is cached locally and syncs when connection
// is restored.
if (typeof window !== "undefined" && app) {
  const firestoreDb = getDbSafe();
  if (firestoreDb) {
    enableIndexedDbPersistence(firestoreDb).catch((err) => {
      if (err.code === "failed-precondition") {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn("Firestore persistence: multiple tabs open");
      } else if (err.code === "unimplemented") {
        // Browser doesn't support IndexedDB
        console.warn("Firestore persistence: browser does not support IndexedDB");
      } else {
        console.warn("Firestore persistence failed:", err);
      }
    });
  }
}
