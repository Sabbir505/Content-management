import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import type { PlatformConnection, PlatformType } from "../types";

interface ConnectionData {
  connected: boolean;
  connectedAt: string | null;
  tokenEncrypted: string | null;
  tokenExpiry: string | null;
  platformUserId: string | null;
  platformUsername: string | null;
  refreshToken: string | null;
}

interface UserConnectionsDoc {
  userId: string;
  connections: Record<PlatformType, ConnectionData>;
  updatedAt: string;
}

function defaultConnection(): ConnectionData {
  return {
    connected: false,
    connectedAt: null,
    tokenEncrypted: null,
    tokenExpiry: null,
    platformUserId: null,
    platformUsername: null,
    refreshToken: null,
  };
}

function toPlatformConnection(
  platform: PlatformType,
  data: ConnectionData
): PlatformConnection {
  return {
    platform,
    connected: data.connected,
    connectedAt: data.connectedAt,
    tokenExpiry: data.tokenExpiry,
    platformUserId: data.platformUserId,
    platformUsername: data.platformUsername,
  };
}

export async function getUserConnections(
  userId: string
): Promise<PlatformConnection[]> {
  const docRef = doc(db, "platformConnections", userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return (["youtube", "x", "instagram", "facebook"] as PlatformType[]).map(
      (p) => toPlatformConnection(p, defaultConnection())
    );
  }

  const data = docSnap.data() as UserConnectionsDoc;
  return (["youtube", "x", "instagram", "facebook"] as PlatformType[]).map(
    (p) => toPlatformConnection(p, data.connections[p] || defaultConnection())
  );
}

export async function connectPlatform(
  userId: string,
  platform: PlatformType,
  connectionData: Omit<ConnectionData, "connected" | "connectedAt">
): Promise<void> {
  const docRef = doc(db, "platformConnections", userId);
  const docSnap = await getDoc(docRef);

  const now = new Date().toISOString();
  const newConnection: ConnectionData = {
    ...connectionData,
    connected: true,
    connectedAt: now,
  };

  if (!docSnap.exists()) {
    const connections: Record<PlatformType, ConnectionData> = {
      youtube: defaultConnection(),
      x: defaultConnection(),
      instagram: defaultConnection(),
      facebook: defaultConnection(),
    };
    connections[platform] = newConnection;

    await setDoc(docRef, {
      userId,
      connections,
      updatedAt: now,
    });
  } else {
    await updateDoc(docRef, {
      [`connections.${platform}`]: newConnection,
      updatedAt: now,
    });
  }
}

export async function disconnectPlatform(
  userId: string,
  platform: PlatformType
): Promise<void> {
  const docRef = doc(db, "platformConnections", userId);
  await updateDoc(docRef, {
    [`connections.${platform}`]: defaultConnection(),
    updatedAt: new Date().toISOString(),
  });
}

export async function getConnectionToken(
  userId: string,
  platform: PlatformType
): Promise<string | null> {
  const docRef = doc(db, "platformConnections", userId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return null;

  const data = docSnap.data() as UserConnectionsDoc;
  const conn = data.connections[platform];
  if (!conn?.connected || !conn.tokenEncrypted) return null;

  // Check if token is expired
  if (conn.tokenExpiry && new Date(conn.tokenExpiry) < new Date()) {
    return null;
  }

  return conn.tokenEncrypted;
}
