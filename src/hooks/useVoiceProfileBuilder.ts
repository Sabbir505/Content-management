"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  type VoiceFingerprint,
  type VoiceProfileVersion,
  type VoiceProfileData,
  analyzeText,
  extractVideoId,
} from "@/lib/voice-analysis";

interface AnalyzeAndBuildOptions {
  onProgress?: (progress: number, stepIndex: number) => void;
  onComplete?: (fingerprint: VoiceFingerprint) => void;
  analysisSteps?: string[];
}

export function useVoiceProfileBuilder() {
  const { user } = useAuth();
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null);
  const [versions, setVersions] = useState<VoiceProfileVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid, "voiceProfile", "default");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as VoiceProfileData;
        if (data.versions && data.versions.length > 0) {
          const latest = data.versions[data.versions.length - 1];
          setFingerprint(latest.fingerprint);
          setVersions(data.versions);
          setCurrentVersion(data.currentVersion);
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Defer so setState inside loadProfile doesn't run synchronously in the effect
    queueMicrotask(() => void loadProfile());
  }, [user, loadProfile]);

  const analyzeAndBuild = useCallback(async (
    text: string,
    sources: string[],
    options: AnalyzeAndBuildOptions = {}
  ) => {
    const { onProgress, onComplete, analysisSteps } = options;
    const steps = analysisSteps || [
      "Extracting text & transcripts...",
      "Detecting hook styles...",
      "Analyzing sentence patterns...",
      "Building voice fingerprint...",
    ];

    for (let i = 0; i < steps.length; i++) {
      if (!mountedRef.current) return null;
      onProgress?.(((i + 1) / steps.length) * 100, i);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (!mountedRef.current) return null;
    const newFingerprint = analyzeText(text);
    setFingerprint(newFingerprint);

    if (user) {
      const newVersion: VoiceProfileVersion = {
        id: `v-${Date.now()}`,
        fingerprint: newFingerprint,
        sources,
        createdAt: new Date().toISOString(),
        version: currentVersion + 1,
      };

      const updatedVersions = [...versions, newVersion];
      setVersions(updatedVersions);
      setCurrentVersion(currentVersion + 1);

      await setDoc(
        doc(db, "users", user.uid, "voiceProfile", "default"),
        {
          id: "default",
          userId: user.uid,
          name: "My Voice",
          currentVersion: currentVersion + 1,
          versions: updatedVersions,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    if (!mountedRef.current) return null;
    onComplete?.(newFingerprint);
    return newFingerprint;
  }, [user, versions, currentVersion]);

  const fetchTranscriptsFromLinks = useCallback(async (videoLinks: string): Promise<string> => {
    const links = videoLinks.split("\n").filter((l) => l.trim());
    let combinedText = "";
    for (const link of links) {
      const videoId = extractVideoId(link.trim());
      if (!videoId) continue;
      try {
        const response = await fetch(`/api/youtube/transcript?videoId=${videoId}`);
        const result = await response.json();
        if (result.success && result.data) {
          combinedText += result.data.transcript + "\n\n";
        }
      } catch {
        // Skip failed transcripts
      }
    }
    return combinedText;
  }, []);

  const handleFeedbackSubmit = useCallback(async (feedback: { rating: number; tags: string[] }) => {
    if (!user || !fingerprint) return;
    const updatedVersions = versions.map((v, i) =>
      i === versions.length - 1
        ? { ...v, feedback: { rating: feedback.rating, tags: feedback.tags } }
        : v
    );
    setVersions(updatedVersions);
    await setDoc(
      doc(db, "users", user.uid, "voiceProfile", "default"),
      {
        versions: updatedVersions,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    toast.success("Feedback saved! Profile will refine over time.");
  }, [user, fingerprint, versions]);

  const handleRevert = useCallback((version: VoiceProfileVersion) => {
    setFingerprint(version.fingerprint);
    setCurrentVersion(version.version);
    toast.success(`Reverted to version ${version.version}`);
  }, []);

  const handleManualEdit = useCallback((newFingerprint: VoiceFingerprint) => {
    setFingerprint(newFingerprint);
    toast.success("Profile updated manually");
  }, []);

  return {
    user,
    fingerprint,
    versions,
    currentVersion,
    loadProfile,
    analyzeAndBuild,
    fetchTranscriptsFromLinks,
    handleFeedbackSubmit,
    handleRevert,
    handleManualEdit,
  };
}
