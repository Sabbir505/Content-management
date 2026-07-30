"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCcw, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { VOICE_QUESTIONS } from "@/lib/voice-questions";
import { useVoiceProfileBuilder } from "@/hooks/useVoiceProfileBuilder";
import { InputSourceSelector } from "@/components/voice/InputSourceSelector";
import { VoiceFingerprintCard } from "@/components/voice/VoiceFingerprintCard";
import { FeedbackForm } from "@/components/voice/FeedbackForm";
import { VersionHistory } from "@/components/voice/VersionHistory";

const SAMPLE_MAX = 10000;
const LINKS_MAX = 2000;

const STEPS = [
  { id: "sources", label: "Source" },
  { id: "input", label: "Input" },
  { id: "analyzing", label: "Analyze" },
  { id: "result", label: "Result" },
] as const;

function stepIndex(step: string): number {
  const idx = STEPS.findIndex((s) => s.id === step);
  if (idx >= 0) return idx;
  if (step === "feedback" || step === "history") return 3;
  return 0;
}


// ---- Main Page ----

function VoiceProfileContent() {
  const router = useRouter();
  const { isLoading } = useAuth();
  const {
    user,
    fingerprint,
    versions,
    currentVersion,
    analyzeAndBuild,
    fetchTranscriptsFromLinks,
    handleFeedbackSubmit,
    handleRevert,
  } = useVoiceProfileBuilder();

  // Flow state
  const [step, setStep] = useState<"sources" | "input" | "analyzing" | "result" | "feedback" | "history">("sources");
  const [inputMethod, setInputMethod] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [, setIsEditing] = useState(false);

  // Input states
  const [sampleText, setSampleText] = useState("");
  const [videoLinks, setVideoLinks] = useState("");
  const [chatAnswers, setChatAnswers] = useState<Record<string, string>>({});
  const [chatStep, setChatStep] = useState(0);

  // Feedback
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  async function handleAnalyzeSample() {
    if (!sampleText.trim()) {
      toast.error("Please paste some sample text");
      return;
    }
    setIsAnalyzing(true);
    setStep("analyzing");
    await analyzeAndBuild(sampleText, ["sample text"], {
      onProgress: (progress) => setAnalysisProgress(progress),
      onComplete: () => {
        setIsAnalyzing(false);
        setStep("result");
      },
    });
  }

  async function handleAnalyzeLinks() {
    if (!videoLinks.trim()) {
      toast.error("Please paste at least one video link");
      return;
    }

    setIsAnalyzing(true);
    setStep("analyzing");

    const combinedText = await fetchTranscriptsFromLinks(videoLinks);

    if (!combinedText) {
      toast.error("Could not fetch transcripts from the provided links");
      setIsAnalyzing(false);
      setStep("input");
      return;
    }

    await analyzeAndBuild(combinedText, ["youtube links"], {
      onProgress: (progress) => setAnalysisProgress(progress),
      onComplete: () => {
        setIsAnalyzing(false);
        setStep("result");
      },
    });
  }

  function handleSourceSelect(method: string) {
    setInputMethod(method);
    setStep("input");
  }

  function handleChatAnswer(answer: string) {
    const currentQuestion = VOICE_QUESTIONS[chatStep];
    const updatedAnswers = { ...chatAnswers, [currentQuestion.key]: answer };
    setChatAnswers(updatedAnswers);

    if (chatStep < VOICE_QUESTIONS.length - 1) {
      setChatStep(chatStep + 1);
    } else {
      const text = Object.values(updatedAnswers).join(". ");
      setIsAnalyzing(true);
      setStep("analyzing");
      analyzeAndBuild(text, ["guided chat"], {
        onProgress: (progress) => setAnalysisProgress(progress),
        onComplete: () => {
          setIsAnalyzing(false);
          setStep("result");
        },
      });
    }
  }

  async function handleFeedbackWrapper(feedback: { rating: number; tags: string[] }) {
    await handleFeedbackSubmit(feedback);
    setHasSubmittedFeedback(true);
  }

  const chatProgress = ((chatStep + 1) / VOICE_QUESTIONS.length) * 100;


  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-9 w-48 bg-[#1a1a1a]" />
          <Skeleton className="h-4 w-72 bg-[#1a1a1a]" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
            <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
            <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <Card className="w-full max-w-md bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2 text-white">Sign In Required</h2>
            <p className="text-[#888] mb-4">Please sign in to build your voice profile.</p>
            <Button
              onClick={() => router.push("/auth/login")}
              className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
            >
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-md px-1 py-0.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {versions.length > 0 && step === "sources" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("history")}
                className="bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] transition-colors cursor-pointer"
              >
                History ({versions.length})
              </Button>
            )}
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-1 text-white">Voice Profile</h1>
            <p className="text-[#888]">
              {step === "sources" && "Choose how to build your voice fingerprint"}
              {step === "input" && "Add your content"}
              {step === "analyzing" && "Analyzing your voice..."}
              {step === "result" && "Your Voice Fingerprint"}
              {step === "feedback" && "Help us improve"}
              {step === "history" && "Version History"}
            </p>
          </div>

          {/* Step indicator */}
          {step !== "history" && (
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => {
                const current = stepIndex(step);
                const isDone = i < current;
                const isActive = i === current;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <div
                      className={[
                        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        isActive
                          ? "bg-[#1a1a1a] border border-[#3a3a3a] text-white"
                          : isDone
                            ? "text-[#ccc]"
                            : "text-[#666]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] border transition-colors",
                          isActive
                            ? "bg-emerald-400 text-[#0a0a0a] border-emerald-400"
                            : isDone
                              ? "bg-[#2a2a2a] text-emerald-400 border-[#3a3a3a]"
                              : "bg-transparent text-[#666] border-[#2a2a2a]",
                        ].join(" ")}
                      >
                        {isDone ? <Check className="w-3 h-3" /> : i + 1}
                      </span>
                      {s.label}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-6 h-px ${i < current ? "bg-[#3a3a3a]" : "bg-[#2a2a2a]"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Source Selection */}
        {step === "sources" && (
          <div className="space-y-8">
            <InputSourceSelector onSelect={handleSourceSelect} />

            {versions.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[#888] mb-3 uppercase tracking-wider">Recent Versions</h3>
                <VersionHistory versions={versions.slice(-3)} onRevert={handleRevert} />
              </div>
            )}
          </div>
        )}

        {/* Input Methods */}
        {step === "input" && inputMethod === "chat" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Question {chatStep + 1} of {VOICE_QUESTIONS.length}</CardTitle>
              <Progress
                value={chatProgress}
                className="h-2 mt-2 bg-[#2a2a2a] [&>div>div]:bg-emerald-400"
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-medium text-white">{VOICE_QUESTIONS[chatStep].question}</p>
              <div className="space-y-2">
                {VOICE_QUESTIONS[chatStep].options.map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    className="w-full justify-start h-auto p-4 text-left bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] transition-colors focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                    onClick={() => handleChatAnswer(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "file" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Upload Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block cursor-pointer border-2 border-dashed border-[#2a2a2a] rounded-lg p-12 text-center hover:border-[#3a3a3a] hover:bg-[#0a0a0a] transition-colors focus-within:ring-2 focus-within:ring-[#3a3a3a] focus-within:ring-offset-2 focus-within:ring-offset-[#1a1a1a]">
                <p className="text-[#ccc] mb-2">Drag and drop files here</p>
                <p className="text-sm text-[#666]">.txt, .docx, .csv</p>
                <input
                  type="file"
                  accept=".txt,.docx,.csv"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result as string;
                        setSampleText(text);
                        analyzeAndBuild(text, ["file upload"]);
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </label>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("sources")}
                  className="flex-1 bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] transition-colors focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a]"
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "links" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Paste Video Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Paste YouTube video URLs (one per line)..."
                  value={videoLinks}
                  onChange={(e) => setVideoLinks(e.target.value.slice(0, LINKS_MAX))}
                  className="min-h-[150px] bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] focus-visible:border-[#3a3a3a] transition-colors"
                />
                <div className="flex justify-end">
                  <span className="text-xs text-[#666]">
                    {videoLinks.length}/{LINKS_MAX}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleAnalyzeLinks}
                  disabled={isAnalyzing}
                  className="flex-1 bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0a0a0a]" />
                      Analyzing...
                    </span>
                  ) : (
                    "Analyze Videos"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("sources")}
                  disabled={isAnalyzing}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "youtube" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Import from YouTube Channel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-[#888]">
                Connect your YouTube channel to analyze your existing videos and build a voice profile.
              </p>
              <Button
                onClick={() => {
                  toast.info("Use the Channel Analytics page to connect your channel");
                  router.push("/channel");
                }}
                className="w-full bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
              >
                Go to Channel Analytics
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("sources")}
                className="w-full bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "sample" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Paste Sample Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  placeholder="Paste a script, transcript, or any text you've written..."
                  value={sampleText}
                  onChange={(e) => setSampleText(e.target.value.slice(0, SAMPLE_MAX))}
                  className="min-h-[200px] bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-[#666] focus-visible:ring-1 focus-visible:ring-[#3a3a3a] focus-visible:border-[#3a3a3a] transition-colors"
                />
                <div className="flex justify-end">
                  <span className="text-xs text-[#666]">
                    {sampleText.length}/{SAMPLE_MAX}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleAnalyzeSample}
                  disabled={isAnalyzing}
                  className="flex-1 bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isAnalyzing ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0a0a0a]" />
                      Analyzing...
                    </span>
                  ) : (
                    "Analyze Voice"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("sources")}
                  disabled={isAnalyzing}
                  className="bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Progress */}
        {step === "analyzing" && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mb-4" />
                <p className="text-lg font-medium mb-2 text-white">Analyzing your voice...</p>
                <Progress
                  value={analysisProgress}
                  className="w-full max-w-md bg-[#2a2a2a] [&>div>div]:bg-emerald-400"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results — dashboard layout */}
        {step === "result" && fingerprint && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              <VoiceFingerprintCard
                fingerprint={fingerprint}
                version={currentVersion}
                onEdit={() => setIsEditing(true)}
              />

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => setStep("sources")}
                  variant="outline"
                  className="flex-1 bg-[#1a1a1a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Build Another
                </Button>
                <Button
                  onClick={() => router.push("/discover")}
                  className="flex-1 bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Use in Generator
                </Button>
              </div>
            </div>

            {/* Right rail — feedback / confirmation */}
            <div className="space-y-4">
              {hasSubmittedFeedback ? (
                <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <CardContent className="p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-5 h-5 text-emerald-400" />
                    </div>
                    <p className="text-sm text-white font-medium">Thanks for your feedback</p>
                    <p className="text-xs text-[#888] mt-1">It helps us tune the analysis.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="text-white text-base">How does this look?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FeedbackForm onSubmit={handleFeedbackWrapper} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Result empty state — analysis finished but no fingerprint was produced */}
        {step === "result" && !fingerprint && (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="p-8 text-center">
              <p className="text-[#ccc] mb-2">We couldn&apos;t build a fingerprint from that input</p>
              <p className="text-sm text-[#666] mb-4">
                Try again with more text or a different source.
              </p>
              <Button
                onClick={() => setStep("sources")}
                className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* History */}
        {step === "history" && (
          <div className="space-y-6">
            <button
              onClick={() => setStep("sources")}
              className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded-md px-1 py-0.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Sources
            </button>
            {versions.length === 0 ? (
              <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                <CardContent className="p-8 text-center">
                  <p className="text-[#ccc] mb-2">No saved versions yet</p>
                  <p className="text-sm text-[#666] mb-4">
                    Build a voice profile to start your version history.
                  </p>
                  <Button
                    onClick={() => setStep("sources")}
                    className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors cursor-pointer"
                  >
                    Build a Profile
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <VersionHistory versions={versions} onRevert={handleRevert} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}


export default function VoiceProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
          <div className="w-full max-w-md space-y-4">
            <Skeleton className="h-9 w-48 bg-[#1a1a1a]" />
            <Skeleton className="h-4 w-72 bg-[#1a1a1a]" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
              <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
              <Skeleton className="h-20 w-full bg-[#1a1a1a]" />
            </div>
          </div>
        </div>
      }
    >
      <VoiceProfileContent />
    </Suspense>
  );
}
