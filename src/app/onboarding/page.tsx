"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

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

const PLATFORMS = [
  { value: "youtube", label: "YouTube" },
  { value: "x", label: "X / Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
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
         Tier: "starter",
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {step === 1 && "What kind of creator are you?"}
            {step === 2 && "What's your niche?"}
            {step === 3 && "Where do you want to post?"}
          </CardTitle>
          <CardDescription>
            Step {step} of 3
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <RadioGroup value={creatorType} onValueChange={setCreatorType} className="space-y-4">
              {CREATOR_TYPES.map((type) => (
                <RadioGroupItem
                  key={type.value}
                  value={type.value}
                  id={type.value}
                  className="flex flex-col items-start rounded-lg border-2 border-muted bg-white p-4 hover:bg-gray-50 data-checked:border-blue-600 cursor-pointer w-full h-auto"
                >
                  <span className="font-semibold">{type.label}</span>
                  <span className="text-sm text-gray-500">{type.description}</span>
                </RadioGroupItem>
              ))}
            </RadioGroup>
          )}

          {step === 2 && (
            <div className="grid grid-cols-3 gap-3">
              {NICHES.map((n) => (
                <button
                  key={n}
                  onClick={() => toggleNiche(n)}
                  className={`rounded-lg border-2 p-3 text-sm font-medium transition-colors ${
                    selectedNiches.includes(n)
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {PLATFORMS.map((platform) => (
                <div key={platform.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={platform.value}
                    checked={selectedPlatforms.includes(platform.value)}
                    onCheckedChange={() => togglePlatform(platform.value)}
                  />
                  <Label htmlFor={platform.value} className="font-medium">
                    {platform.label}
                  </Label>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={handleBack} className="flex-1">
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
              className="flex-1"
            >
              {isLoading ? "Saving..." : step === 3 ? "Complete" : "Next"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
