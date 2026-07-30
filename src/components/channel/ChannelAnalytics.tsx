"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useChannelAnalyticsState } from "@/hooks/useChannelAnalyticsState";
import { useChannelData } from "@/hooks/useChannelData";
import { useConnectChannel } from "@/hooks/useConnectChannel";
import { ChannelTabContent } from "./ChannelTabContent";

export function ChannelAnalytics() {
  const myChannel = useChannelAnalyticsState();

  const [channelUrl, setChannelUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { analyzeChannel } = useChannelData({
    onStart() {
      myChannel.setIsLoading(true); setIsAnalyzing(true);
    },
    onSuccess(data) {
      myChannel.setChannelName(data.channelName);
      myChannel.setChannelThumbnail(data.channelThumbnail);
      myChannel.setSubscriberCount(data.subscriberCount);
      myChannel.setVideoCount(data.videoCount);
      myChannel.setVideos(data.videos);
      myChannel.setStats(data.stats);
      myChannel.setIsLoading(false);
      setIsAnalyzing(false);
    },
    onError() {
      myChannel.setIsLoading(false); setIsAnalyzing(false);
    },
  });

  const { channel, isConnecting, isConnected, connectChannel } = useConnectChannel();

  const analyzedRef = useRef<string | null>(null);

  const handleConnectChannel = useCallback(async () => {
    await connectChannel((ch) => {
      myChannel.setChannelName(ch.title);
      myChannel.setChannelThumbnail(ch.thumbnail);
      myChannel.setSubscriberCount(ch.subscriberCount);
      myChannel.setVideoCount(ch.videoCount);
      analyzedRef.current = ch.channelId;
      analyzeChannel(ch.channelId);
    });
  }, [connectChannel, myChannel, analyzeChannel]);

  function handleAnalyze() {
    analyzeChannel(channelUrl);
  }

  // Auto-analyze connected channel on mount so the My Channel tab shows data without a manual reconnect
  useEffect(() => {
    if (!isConnected || !channel?.channelId) return;
    if (analyzedRef.current === channel.channelId) return;
    analyzedRef.current = channel.channelId;
    analyzeChannel(channel.channelId);
  }, [isConnected, channel?.channelId, analyzeChannel]);

  return (
    <div className="space-y-6 pt-4">
      <ChannelTabContent
        state={myChannel}
        channelUrl={channelUrl}
        setChannelUrl={setChannelUrl}
        isAnalyzing={isAnalyzing}
        onAnalyze={handleAnalyze}
        isMyChannel
        onConnectChannel={handleConnectChannel}
        isConnecting={isConnecting}
        isConnected={isConnected}
      />
    </div>
  );
}
