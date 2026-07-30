"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateUserChannel } from "@/lib/user-profile";
import { GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

interface YouTubeChannel {
  channelId: string;
  title: string;
  description: string;
  thumbnail: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

interface UseConnectChannelReturn {
  channel: YouTubeChannel | null;
  isConnecting: boolean;
  isConnected: boolean;
  connectChannel: (onConnected?: (ch: YouTubeChannel) => void) => Promise<void>;
  disconnectChannel: () => Promise<void>;
  refreshChannel: () => Promise<void>;
}

async function getGoogleAccessToken(): Promise<string> {
  // Try localStorage first
  const stored = localStorage.getItem("google_access_token");
  if (stored) {
    // Verify it's still valid by hitting our server-side API
    const testResponse = await fetch("/api/youtube/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: stored }),
    });
    if (testResponse.ok) return stored;
    // Token rejected (expired/revoked) or server errored — drop it and re-auth.
    localStorage.removeItem("google_access_token");
  }

  // Token missing or expired — re-authenticate with Google
  const provider = new GoogleAuthProvider();
  provider.addScope("https://www.googleapis.com/auth/youtube.readonly");

  const result = auth.currentUser
    ? await reauthenticateWithPopup(auth.currentUser, provider)
    : await signInWithPopup(auth, provider);

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const newToken = credential?.accessToken;
  if (!newToken) {
    throw new Error("Failed to get YouTube access. Please sign out and sign in again with Google.");
  }

  localStorage.setItem("google_access_token", newToken);
  return newToken;
}

async function fetchYouTubeChannel(accessToken: string): Promise<YouTubeChannel> {
  const response = await fetch("/api/youtube/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok || !isJson) {
    // A non-JSON body means the server returned an error page (e.g. worker crash)
    // rather than our route's JSON error — don't try to parse it as JSON.
    const serverMessage = body?.error;
    throw new Error(
      serverMessage ||
        `YouTube connection failed (${response.status || "no response"}). Reconnect your Google account.`
    );
  }

  if (!body.success || !body.data) {
    throw new Error(body.error || "No YouTube channel found for this account");
  }

  const channelData = body.data;
  return {
    channelId: channelData.channelId,
    title: channelData.title,
    description: channelData.description,
    thumbnail: channelData.thumbnail,
    subscriberCount: channelData.subscriberCount,
    videoCount: channelData.videoCount,
    viewCount: channelData.viewCount,
  };
}

export function useConnectChannel(): UseConnectChannelReturn {
  const { user, profile } = useAuth();
  const [channel, setChannel] = useState<YouTubeChannel | null>(() => {
    if (profile?.youtubeChannelId) {
      return {
        channelId: profile.youtubeChannelId,
        title: profile.youtubeChannelTitle || "",
        description: "",
        thumbnail: profile.youtubeChannelThumbnail || "",
        subscriberCount: 0,
        videoCount: 0,
        viewCount: 0,
      };
    }
    return null;
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(() => !!(profile?.youtubeChannelId));
  const channelSetRef = useRef(false);

  useEffect(() => {
    if (profile?.youtubeChannelId && !channelSetRef.current) {
      channelSetRef.current = true;
      setChannel({
        channelId: profile.youtubeChannelId,
        title: profile.youtubeChannelTitle || "",
        description: "",
        thumbnail: profile.youtubeChannelThumbnail || "",
        subscriberCount: 0,
        videoCount: 0,
        viewCount: 0,
      });
      setIsConnected(true);
    }
  }, [profile]);

  const connectChannel = useCallback(async (onConnected?: (ch: YouTubeChannel) => void) => {
    if (!user) {
      toast.error("Please sign in first");
      return;
    }

    setIsConnecting(true);
    try {
      const accessToken = await getGoogleAccessToken();
      const channelInfo = await fetchYouTubeChannel(accessToken);

      await updateUserChannel(user.uid, {
        youtubeChannelId: channelInfo.channelId,
        youtubeChannelTitle: channelInfo.title,
        youtubeChannelThumbnail: channelInfo.thumbnail,
      });

      setChannel(channelInfo);
      setIsConnected(true);
      onConnected?.(channelInfo);
      toast.success(`Connected to ${channelInfo.title}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect channel");
    } finally {
      setIsConnecting(false);
    }
  }, [user]);

  const disconnectChannel = useCallback(async () => {
    if (!user) return;

    try {
      await updateUserChannel(user.uid, {
        youtubeChannelId: "",
        youtubeChannelTitle: "",
        youtubeChannelThumbnail: "",
      });

      localStorage.removeItem("google_access_token");
      setChannel(null);
      setIsConnected(false);
      toast.success("Channel disconnected");
    } catch {
      toast.error("Failed to disconnect channel");
    }
  }, [user]);

  const refreshChannel = useCallback(async () => {
    if (!user) return;

    const token = localStorage.getItem("google_access_token");
    if (!token) return;

    try {
      const channelInfo = await fetchYouTubeChannel(token);
      setChannel(channelInfo);
    } catch {
      // token likely expired, silently fail — user can reconnect
    }
  }, [user]);

  // Fetch actual channel stats on mount if we have a channel ID
  useEffect(() => {
    if (profile?.youtubeChannelId && isConnected) {
      // Defer so setState inside refreshChannel doesn't run synchronously in the effect
      queueMicrotask(() => void refreshChannel());
    }
  }, [profile?.youtubeChannelId, isConnected, refreshChannel]);

  return {
    channel,
    isConnecting,
    isConnected,
    connectChannel,
    disconnectChannel,
    refreshChannel,
  };
}
