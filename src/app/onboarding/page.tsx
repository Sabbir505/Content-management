"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useAuth } from "@/hooks/useAuth";
import { PLATFORM_TYPES } from "@/lib/quality/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X / Twitter",
  instagram: "Instagram",
  facebook: "Facebook",
};

const CREATOR_TYPES = [
  { value: "solo", label: "Solo YouTuber", description: "Just me creating content" },
  { value: "multiple", label: "Multiple Channels", description: "I manage multiple channels or brands" },
  { value: "agency", label: "Agency", description: "I manage content for multiple clients" },
];

const NICHES = [
  "Finance",
  "Tech",
  "Lifestyle",
  "Education",
  "Entertainment",
  "Health",
  "Business",
  "Gaming",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [creatorType, setCreatorType] = useState("");
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  function handleNext() {
    if (step < 3) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    }
  }

  async function handleComplete() {
    if (!user) {
      toast.error("You must be signed in to complete onboarding");
      return;
    }

    setIsLoading(true);
    try {
        // Import dynamically to avoid SSR issues with Firebase
        const { doc, setDoc } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          creatorType,
          niche: selectedNiches,
          platforms: selectedPlatforms,
          onboardingComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // PLACEHOLDER for billing: replace with real tier/credits once the billing system lands
          tier: "starter",
          creditsUsed: 0,
          creditsLimit: 300,
        });
        router.push("/discover");
    } catch (error) {
      console.error("Error saving onboarding data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  }

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche) ? prev.filter((n) => n !== niche) : [...prev, niche]
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4 py-8">
      <Card className="w-full max-w-lg bg-[#1a1a1a] border-[#2a2a2a]">
        <CardHeader className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2 pt-1">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-colors",
                  s === step ? "w-8 bg-emerald-400" : s < step ? "w-4 bg-[#3a3a3a]" : "w-4 bg-[#2a2a2a]"
                )}
              />
            ))}
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            {step === 1 && "What kind of creator are you?"}
            {step === 2 && "What's your niche?"}
            {step === 3 && "Where do you want to post?"}
          </CardTitle>
          <CardDescription className="text-[#888]">
            Step {step} of 3
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-3">
              {CREATOR_TYPES.map((type) => {
                const selected = creatorType === type.value;
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setCreatorType(type.value)}
                    className={cn(
                      "flex flex-col items-start rounded-lg border p-4 w-full text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
                      selected
                        ? "border-emerald-400 bg-emerald-400/10"
                        : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
                    )}
                  >
                    <span className={cn("font-semibold", selected ? "text-white" : "text-[#ccc]")}>
                      {type.label}
                    </span>
                    <span className="text-sm text-[#888]">{type.description}</span>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {NICHES.map((n) => {
                const selected = selectedNiches.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNiche(n)}
                    className={cn(
                      "rounded-lg border p-3 text-sm font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
                      selected
                        ? "border-emerald-400 bg-emerald-400/10 text-white"
                        : "border-[#2a2a2a] bg-[#0a0a0a] text-[#ccc] hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              {PLATFORM_TYPES.map((platform) => {
                const selected = selectedPlatforms.includes(platform);
                return (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 w-full text-left transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]",
                      selected
                        ? "border-emerald-400 bg-emerald-400/10"
                        : "border-[#2a2a2a] bg-[#0a0a0a] hover:border-[#3a3a3a] hover:bg-[#1a1a1a]"
                    )}
                  >
                    <div
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center border-2 transition-colors",
                        selected ? "border-emerald-400 bg-emerald-400" : "border-[#3a3a3a]"
                      )}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-[#0a0a0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={cn("font-medium", selected ? "text-white" : "text-[#ccc]")}>
                      {PLATFORM_LABELS[platform]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1 border-[#2a2a2a] bg-transparent text-[#ccc] hover:bg-[#0a0a0a] hover:text-white hover:border-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={
                (step === 1 && !creatorType) ||
                (step === 2 && selectedNiches.length === 0) ||
                (step === 3 && selectedPlatforms.length === 0) ||
                isLoading
              }
              className="flex-1 bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "Saving..." : step === 3 ? "Complete" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
