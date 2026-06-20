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
  connectChannel: () => Promise<void>;
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
  }

  // Token missing or expired — re-authenticate with Google
  localStorage.removeItem("google_access_token");

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

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(`YouTube API error: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || "No YouTube channel found for this account");
  }

  const channelData = result.data;
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

  const connectChannel = useCallback(async () => {
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
    } catch (error) {
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
      refreshChannel();
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
