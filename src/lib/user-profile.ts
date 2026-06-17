import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { User } from "firebase/auth";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  youtubeChannelId: string | null;
  youtubeChannelTitle: string | null;
  youtubeChannelThumbnail: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function createOrUpdateUserProfile(user: User): Promise<UserProfile> {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  const now = new Date().toISOString();

  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    youtubeChannelId: null,
    youtubeChannelTitle: null,
    youtubeChannelThumbnail: null,
    connectedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  if (userSnap.exists()) {
    const existing = userSnap.data() as UserProfile;
    await updateDoc(userRef, {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: now,
    });
    return { ...profile, ...existing, createdAt: existing.createdAt };
  }

  await setDoc(userRef, profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    return null;
  }

  return userSnap.data() as UserProfile;
}

export async function updateUserChannel(
  uid: string,
  channelData: {
    youtubeChannelId: string;
    youtubeChannelTitle: string;
    youtubeChannelThumbnail: string;
  }
): Promise<void> {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, {
    ...channelData,
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
