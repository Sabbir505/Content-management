"use client";

import { useState, Suspense, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { doc, setDoc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

// ---- Types ----

interface VoiceFingerprint {
  hookStyle: string;
  sentenceLength: string;
  tone: string;
  vocabulary: string;
  humorLevel: string;
  ctaPattern: string;
  sampleSentences?: string[];
}

interface VoiceProfileVersion {
  id: string;
  fingerprint: VoiceFingerprint;
  sources: string[];
  createdAt: string;
  version: number;
  feedback?: {
    rating: number;
    tags: string[];
  };
}

interface VoiceProfileData {
  id: string;
  userId: string;
  name: string;
  currentVersion: number;
  versions: VoiceProfileVersion[];
  createdAt: string;
  updatedAt: string;
}

// ---- Analysis ----

function analyzeText(text: string): VoiceFingerprint {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const avgSentenceLength = words.length / Math.max(sentences.length, 1);

  // Detect hook style
  const firstSentence = sentences[0]?.toLowerCase() || "";
  let hookStyle = "Pattern interrupt";
  if (firstSentence.includes("?")) hookStyle = "Direct question";
  else if (/\d/.test(firstSentence)) hookStyle = "Statistic or number";
  else if (firstSentence.startsWith("i ") || firstSentence.startsWith("my ")) hookStyle = "Personal story";
  else if (firstSentence.includes("you ") || firstSentence.includes("your ")) hookStyle = "Viewer-addressed statement";

  // Detect tone
  const textLower = text.toLowerCase();
  let tone = "Conversational";
  if ((textLower.match(/!/g) || []).length > 3) tone = "Energetic";
  else if (textLower.includes("imagine") || textLower.includes("picture this")) tone = "Inspirational";
  else if (textLower.includes("honestly") || textLower.includes("real talk")) tone = "Authentic/Direct";

  // Detect vocabulary
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const complexity = uniqueWords.size / Math.max(words.length, 1);
  let vocabulary = "Accessible";
  if (complexity > 0.4) vocabulary = "Rich and varied";
  else if (complexity < 0.2) vocabulary = "Simple and direct";

  // Detect humor
  const humorIndicators = ["lol", "haha", "funny", "joke", "hilarious", "ridiculous"];
  const humorCount = humorIndicators.filter((h) => textLower.includes(h)).length;
  let humorLevel = "Minimal";
  if (humorCount > 2) humorLevel = "Occasional, dry";
  if (humorCount > 5) humorLevel = "Frequent";

  // Detect CTA pattern
  const ctaPatterns = [
    { pattern: /subscribe.*now|hit.*subscribe/i, label: "Direct command" },
    { pattern: /let me know.*comment|what do you think/i, label: "Question-based" },
    { pattern: /join.*community|become.*member/i, label: "Community-driven" },
    { pattern: /check.*link|link.*description/i, label: "Resource-driven" },
  ];
  const lastParagraph = text.slice(-500).toLowerCase();
  const matchedCta = ctaPatterns.find((c) => c.pattern.test(lastParagraph));
  const ctaPattern = matchedCta?.label || "Soft suggestion";

  // Sentence length
  let sentenceLength = "Medium (12-15 words)";
  if (avgSentenceLength < 10) sentenceLength = "Short (8-10 words)";
  else if (avgSentenceLength > 18) sentenceLength = "Long (16-20 words)";

  return {
    hookStyle,
    sentenceLength,
    tone,
    vocabulary,
    humorLevel,
    ctaPattern,
    sampleSentences: sentences.slice(0, 3).map((s) => s.trim()),
  };
}

// ---- Components ----

function InputSourceSelector({
  onSelect,
}: {
  onSelect: (method: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <SourceCard
        title="YouTube Channel Import"
        description="Analyze your existing videos to extract your voice"
        icon="🎬"
        onClick={() => onSelect("youtube")}
      />
      <SourceCard
        title="Paste Video Links"
        description="Paste YouTube video URLs to analyze transcripts"
        icon="🔗"
        onClick={() => onSelect("links")}
      />
      <SourceCard
        title="File Upload"
        description="Upload .txt, .docx, or .csv files with your content"
        icon="📁"
        onClick={() => onSelect("file")}
      />
      <SourceCard
        title="Paste Sample Text"
        description="Paste your own script or transcript text to analyze"
        icon="✏️"
        onClick={() => onSelect("sample")}
      />
      <SourceCard
        title="Guided Chat"
        description="Answer questions to define your style"
        icon="💬"
        onClick={() => onSelect("chat")}
      />
    </div>
  );
}

function SourceCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all bg-white"
    >
      <div className="flex items-start gap-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

function VoiceFingerprintCard({
  fingerprint,
  version,
  onEdit,
}: {
  fingerprint: VoiceFingerprint;
  version: number;
  onEdit: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Voice Fingerprint</CardTitle>
          <p className="text-sm text-gray-500">Version {version}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit Manually
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <FingerprintItem label="Hook Style" value={fingerprint.hookStyle} />
        <FingerprintItem label="Sentence Length" value={fingerprint.sentenceLength} />
        <FingerprintItem label="Tone" value={fingerprint.tone} />
        <FingerprintItem label="Vocabulary" value={fingerprint.vocabulary} />
        <FingerprintItem label="Humor Level" value={fingerprint.humorLevel} />
        <FingerprintItem label="CTA Pattern" value={fingerprint.ctaPattern} />

        {fingerprint.sampleSentences && fingerprint.sampleSentences.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm font-medium text-gray-700 mb-2">Sample Sentences</p>
            <div className="space-y-2">
              {fingerprint.sampleSentences.map((sentence, i) => (
                <p key={i} className="text-sm text-gray-600 italic">
                  "{sentence}"
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FingerprintItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right">{value}</span>
    </div>
  );
}

function FeedbackForm({
  onSubmit,
}: {
  onSubmit: (feedback: { rating: number; tags: string[] }) => void;
}) {
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const tags = [
    "Too formal",
    "Too casual",
    "Wrong hooks",
    "Not my tone",
    "Just right",
  ];

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-gray-700">Did this sound like you?</p>

      {/* Star Rating */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => setRating(star)}
            className={`text-2xl transition-colors ${
              star <= rating ? "text-yellow-400" : "text-gray-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              selectedTags.includes(tag)
                ? "bg-blue-100 text-blue-700 border border-blue-300"
                : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <Button
        onClick={() => onSubmit({ rating, tags: selectedTags })}
        disabled={rating === 0}
        className="w-full"
      >
        Submit Feedback
      </Button>
    </div>
  );
}

function VersionHistory({
  versions,
  onRevert,
}: {
  versions: VoiceProfileVersion[];
  onRevert: (version: VoiceProfileVersion) => void;
}) {
  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between p-3 border rounded-lg bg-white"
        >
          <div>
            <p className="text-sm font-medium">Version {v.version}</p>
            <p className="text-xs text-gray-500">
              {new Date(v.createdAt).toLocaleDateString()} · {v.sources.join(", ")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => onRevert(v)}>
            Revert
          </Button>
        </div>
      ))}
    </div>
  );
}

// ---- Main Page ----

const VOICE_QUESTIONS = [
  {
    key: "hookStyle",
    question: "How do you usually start your videos?",
    options: [
      "Direct question to the viewer",
      "Bold statement or hot take",
      "Story or personal anecdote",
      "Shocking fact or statistic",
      "Teaser of what's coming",
    ],
  },
  {
    key: "sentenceLength",
    question: "How would you describe your speaking style?",
    options: [
      "Short, punchy sentences",
      "Medium length, conversational",
      "Long, flowing paragraphs",
      "Mixed - I vary my rhythm",
    ],
  },
  {
    key: "tone",
    question: "What is your default tone?",
    options: [
      "Energetic and enthusiastic",
      "Calm and authoritative",
      "Casual and friendly",
      "Sarcastic and witty",
      "Inspirational and motivational",
    ],
  },
  {
    key: "vocabulary",
    question: "How would you describe your word choice?",
    options: [
      "Simple and accessible",
      "Technical and precise",
      "Creative and descriptive",
      "Industry jargon heavy",
      "Trendy and meme-aware",
    ],
  },
  {
    key: "humorLevel",
    question: "How much humor do you use?",
    options: [
      "None - strictly serious",
      "Occasional dry wit",
      "Frequent jokes and quips",
      "Constant comedy energy",
    ],
  },
  {
    key: "ctaPattern",
    question: "How do you ask viewers to take action?",
    options: [
      "Direct command (Subscribe now!)",
      "Soft suggestion (Consider subscribing)",
      "Value-driven (Join the community)",
      "Question-based (What do you think?)",
      "Minimal - I rarely ask",
    ],
  },
];

function VoiceProfileContent() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Flow state
  const [step, setStep] = useState<"sources" | "input" | "analyzing" | "result" | "feedback" | "history">("sources");
  const [inputMethod, setInputMethod] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);

  // Data
  const [fingerprint, setFingerprint] = useState<VoiceFingerprint | null>(null);
  const [versions, setVersions] = useState<VoiceProfileVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isEditing, setIsEditing] = useState(false);

  // Input states
  const [sampleText, setSampleText] = useState("");
  const [videoLinks, setVideoLinks] = useState("");
  const [chatAnswers, setChatAnswers] = useState<Record<string, string>>({});
  const [chatStep, setChatStep] = useState(0);

  // Feedback
  const [hasSubmittedFeedback, setHasSubmittedFeedback] = useState(false);

  // Load existing profile
  useEffect(() => {
    if (!user) return;
    loadProfile();
  }, [user]);

  async function loadProfile() {
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
  }

  async function analyzeAndBuild(text: string, sources: string[]) {
    setIsAnalyzing(true);
    setStep("analyzing");

    // Simulate analysis steps
    const steps = [
      "Extracting text & transcripts...",
      "Detecting hook styles...",
      "Analyzing sentence patterns...",
      "Building voice fingerprint...",
    ];

    const mountedRef = { current: true };

    for (let i = 0; i < steps.length; i++) {
      if (!mountedRef.current) return;
      setAnalysisProgress(((i + 1) / steps.length) * 100);
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    if (!mountedRef.current) return;
    const newFingerprint = analyzeText(text);
    setFingerprint(newFingerprint);
    setIsAnalyzing(false);
    setStep("result");

    // Save version
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
  }

  function handleSourceSelect(method: string) {
    setInputMethod(method);
    setStep("input");
  }

  async function handleAnalyzeSample() {
    if (!sampleText.trim()) {
      toast.error("Please paste some sample text");
      return;
    }
    await analyzeAndBuild(sampleText, ["sample text"]);
  }

  async function handleAnalyzeLinks() {
    const links = videoLinks.split("\n").filter((l) => l.trim());
    if (links.length === 0) {
      toast.error("Please paste at least one video link");
      return;
    }

    setIsAnalyzing(true);
    setStep("analyzing");

    // Fetch transcripts for each link
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

    if (!combinedText) {
      toast.error("Could not fetch transcripts from the provided links");
      setIsAnalyzing(false);
      setStep("input");
      return;
    }

    await analyzeAndBuild(combinedText, ["youtube links"]);
  }

  function handleChatAnswer(answer: string) {
    const currentQuestion = VOICE_QUESTIONS[chatStep];
    const updatedAnswers = { ...chatAnswers, [currentQuestion.key]: answer };
    setChatAnswers(updatedAnswers);

    if (chatStep < VOICE_QUESTIONS.length - 1) {
      setChatStep(chatStep + 1);
    } else {
      // Build fingerprint from answers
      const text = Object.values(updatedAnswers).join(". ");
      analyzeAndBuild(text, ["guided chat"]);
    }
  }

  async function handleFeedbackSubmit(feedback: { rating: number; tags: string[] }) {
    if (!user || !fingerprint) return;

    const updatedVersions = versions.map((v, i) =>
      i === versions.length - 1
        ? { ...v, feedback: { rating: feedback.rating, tags: feedback.tags } }
        : v
    );

    setVersions(updatedVersions);
    setHasSubmittedFeedback(true);

    await setDoc(
      doc(db, "users", user.uid, "voiceProfile", "default"),
      {
        versions: updatedVersions,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    toast.success("Feedback saved! Profile will refine over time.");
  }

  function handleRevert(version: VoiceProfileVersion) {
    setFingerprint(version.fingerprint);
    setCurrentVersion(version.version);
    toast.success(`Reverted to version ${version.version}`);
  }

  function handleManualEdit(newFingerprint: VoiceFingerprint) {
    setFingerprint(newFingerprint);
    setIsEditing(false);
    toast.success("Profile updated manually");
  }

  const chatProgress = ((chatStep + 1) / VOICE_QUESTIONS.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-4">Please sign in to build your voice profile.</p>
            <Button onClick={() => router.push("/auth/login")}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Voice Profile</h1>
          <p className="text-gray-600">
            {step === "sources" && "Choose how to build your voice fingerprint"}
            {step === "input" && `Input method: ${inputMethod}`}
            {step === "analyzing" && "Analyzing your voice..."}
            {step === "result" && "Your Voice Fingerprint"}
            {step === "feedback" && "Help us improve"}
            {step === "history" && "Version History"}
          </p>
        </div>

        {/* Source Selection */}
        {step === "sources" && (
          <div className="space-y-6">
            <InputSourceSelector onSelect={handleSourceSelect} />

            {versions.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Previous Versions</h3>
                  <Button variant="outline" size="sm" onClick={() => setStep("history")}>
                    View All
                  </Button>
                </div>
                <VersionHistory versions={versions.slice(-3)} onRevert={handleRevert} />
              </div>
            )}
          </div>
        )}

        {/* Input Methods */}
        {step === "input" && inputMethod === "chat" && (
          <Card>
            <CardHeader>
              <CardTitle>Question {chatStep + 1} of {VOICE_QUESTIONS.length}</CardTitle>
              <Progress value={chatProgress} className="h-2 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg font-medium">{VOICE_QUESTIONS[chatStep].question}</p>
              <div className="space-y-2">
                {VOICE_QUESTIONS[chatStep].options.map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    className="w-full justify-start h-auto p-4 text-left"
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
          <Card>
            <CardHeader>
              <CardTitle>Upload Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <p className="text-gray-500 mb-2">Drag and drop files here</p>
                <p className="text-sm text-gray-400">.txt, .docx, .csv</p>
                <input
                  type="file"
                  accept=".txt,.docx,.csv"
                  className="hidden"
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
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("sources")} className="flex-1">
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "links" && (
          <Card>
            <CardHeader>
              <CardTitle>Paste Video Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste YouTube video URLs (one per line)..."
                value={videoLinks}
                onChange={(e) => setVideoLinks(e.target.value)}
                className="min-h-[150px]"
              />
              <div className="flex gap-3">
                <Button onClick={handleAnalyzeLinks} disabled={isAnalyzing} className="flex-1">
                  {isAnalyzing ? "Analyzing..." : "Analyze Videos"}
                </Button>
                <Button variant="outline" onClick={() => setStep("sources")}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "youtube" && (
          <Card>
            <CardHeader>
              <CardTitle>Import from YouTube Channel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Connect your YouTube channel to analyze your existing videos and build a voice profile.
              </p>
              <Button
                onClick={() => {
                  toast.info("Use the Channel Analytics page to connect your channel");
                  router.push("/channel");
                }}
                className="w-full"
              >
                Go to Channel Analytics
              </Button>
              <Button variant="outline" onClick={() => setStep("sources")} className="w-full">
                Back
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "input" && inputMethod === "sample" && (
          <Card>
            <CardHeader>
              <CardTitle>Paste Sample Text</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste a script, transcript, or any text you've written..."
                value={sampleText}
                onChange={(e) => setSampleText(e.target.value)}
                className="min-h-[200px]"
              />
              <div className="flex gap-3">
                <Button onClick={handleAnalyzeSample} disabled={isAnalyzing} className="flex-1">
                  {isAnalyzing ? "Analyzing..." : "Analyze Voice"}
                </Button>
                <Button variant="outline" onClick={() => setStep("sources")}>
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Progress */}
        {step === "analyzing" && (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4" />
                <p className="text-lg font-medium mb-2">Analyzing your voice...</p>
                <Progress value={analysisProgress} className="w-full max-w-md" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {step === "result" && fingerprint && (
          <div className="space-y-6">
            <VoiceFingerprintCard
              fingerprint={fingerprint}
              version={currentVersion}
              onEdit={() => setIsEditing(true)}
            />

            {/* Feedback */}
            {!hasSubmittedFeedback && (
              <Card>
                <CardHeader>
                  <CardTitle>Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <FeedbackForm onSubmit={handleFeedbackSubmit} />
                </CardContent>
              </Card>
            )}

            {hasSubmittedFeedback && (
              <div className="text-center py-4">
                <p className="text-sm text-green-600">Thanks for your feedback!</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={() => setStep("sources")} variant="outline" className="flex-1">
                Build Another Profile
              </Button>
              <Button onClick={() => router.push("/create")} className="flex-1">
                Use in Generator
              </Button>
            </div>
          </div>
        )}

        {/* History */}
        {step === "history" && (
          <div className="space-y-6">
            <Button variant="outline" onClick={() => setStep("sources")}>
              ← Back to Sources
            </Button>
            <VersionHistory versions={versions} onRevert={handleRevert} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Helpers ----

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function VoiceProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>}>
      <VoiceProfileContent />
    </Suspense>
  );
}
