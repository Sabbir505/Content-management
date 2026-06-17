export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string;
  updatedAt: string;
  subscriptionTier: "starter" | "pro" | "studio";
  creditsUsed: number;
  creditsLimit: number;
  creatorType: "solo" | "multiple" | "agency" | null;
  niche: string | null;
  platforms: string[];
  onboardingComplete: boolean;
}

export interface VoiceProfile {
  id: string;
  userId: string;
  name: string;
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
