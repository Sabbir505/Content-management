"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseVideoCardDataArgs {
  videoId: string;
  fullDescription: string | null;
  setFullDescription: (v: string) => void;
  setIsLoadingDescription: (v: boolean) => void;
}

interface UseVideoCardDataResult {
  transcript: string | null;
  isLoadingTranscript: boolean;
  fetchFullDescription: () => Promise<void>;
  fetchTranscript: () => Promise<void>;
}

export function useVideoCardData({
  videoId,
  fullDescription,
  setFullDescription,
  setIsLoadingDescription,
}: UseVideoCardDataArgs): UseVideoCardDataResult {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const mountedRef = useRef(true);
  const descControllerRef = useRef<AbortController | null>(null);
  const transcriptControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      descControllerRef.current?.abort();
      transcriptControllerRef.current?.abort();
    };
  }, []);

  const fetchFullDescription = useCallback(async () => {
    if (!videoId || fullDescription) return;
    descControllerRef.current?.abort();
    const controller = new AbortController();
    descControllerRef.current = controller;
    setIsLoadingDescription(true);
    try {
      const response = await fetch(`/api/youtube/video?videoId=${videoId}`, { signal: controller.signal });
      const result = await response.json();
      if (!mountedRef.current || controller.signal.aborted) return;
      if (result.success && result.data?.description) {
        setFullDescription(result.data.description);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      console.error("Failed to fetch video description:", error);
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setIsLoadingDescription(false);
    }
  }, [videoId, fullDescription, setFullDescription, setIsLoadingDescription]);

  const fetchTranscript = useCallback(async () => {
    if (!videoId || transcript) return;
    transcriptControllerRef.current?.abort();
    const controller = new AbortController();
    transcriptControllerRef.current = controller;
    setIsLoadingTranscript(true);
    try {
      const response = await fetch(`/api/youtube/transcript?videoId=${videoId}`, { signal: controller.signal });
      const result = await response.json();
      if (!mountedRef.current || controller.signal.aborted) return;
      if (result.success && result.data?.transcript) {
        setTranscript(result.data.transcript);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      // Transcript not available for all videos
    } finally {
      if (mountedRef.current && !controller.signal.aborted) setIsLoadingTranscript(false);
    }
  }, [videoId, transcript]);

  return { transcript, isLoadingTranscript, fetchFullDescription, fetchTranscript };
}
