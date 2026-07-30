"use client";

import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import type { VoiceProfile } from "@/types/user";

export function useVoiceProfile() {
  const { user } = useAuth();
  const [voiceProfile, setVoiceProfile] = useState<VoiceProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      return;
    }

    const uid = user.uid;

    async function fetchVoiceProfile() {
      try {
        const docRef = doc(db, "users", uid, "voiceProfile", "default");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setVoiceProfile(docSnap.data() as VoiceProfile);
        }
      } catch (error) {
        console.error("Failed to fetch voice profile:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchVoiceProfile();
  }, [user]);

  function formatVoiceForPrompt(profile: VoiceProfile | null): string {
    if (!profile) return "Conversational, direct, slightly informal";

    return [
      `Hook style: ${profile.hookStyle}`,
      `Sentence length: ${profile.sentenceLength}`,
      `Tone: ${profile.tone}`,
      `Vocabulary: ${profile.vocabulary}`,
      `Humor level: ${profile.humorLevel}`,
      `CTA pattern: ${profile.ctaPattern}`,
    ].join(". ");
  }

  return { voiceProfile, isLoading: isLoading && !!user, formatVoiceForPrompt };
}
