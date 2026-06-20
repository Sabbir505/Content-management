"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import type { Board } from "@/types/board";
import type { ChatSession } from "@/types/chat";
import type { TrackedCreator } from "@/types/creator";

interface RecentChat {
  id: string;
  title: string;
  boardName?: string;
  updatedAt: string;
}

interface CreatorPost {
  id: string;
  title: string;
  thumbnail?: string;
  channelTitle: string;
  publishedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [creators, setCreators] = useState<TrackedCreator[]>([]);
  const [creatorPosts, setCreatorPosts] = useState<CreatorPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [dailyStreak, setDailyStreak] = useState(0);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    setIsLoading(true);

    try {
      // Load boards
      const boardsSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "boards"), orderBy("updatedAt", "desc"), limit(5))
      );
      const loadedBoards: Board[] = [];
      boardsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedBoards.push({
          id: docSnap.id,
          name: data.name,
          description: data.description || "",
          isDefault: data.isDefault || false,
          itemCount: data.itemCount || 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });
      setBoards(loadedBoards);

      // Load recent chats
      const chatsSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "chatSessions"), orderBy("updatedAt", "desc"), limit(5))
      );
      const loadedChats: RecentChat[] = [];
      chatsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedChats.push({
          id: docSnap.id,
          title: data.title || "Untitled Chat",
          boardName: data.boardName,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });
      setRecentChats(loadedChats);

      // Load tracked creators
      const creatorsSnapshot = await getDocs(
        query(collection(db, "users", user.uid, "creators"), orderBy("updatedAt", "desc"), limit(3))
      );
      const loadedCreators: TrackedCreator[] = [];
      creatorsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        loadedCreators.push({
          id: docSnap.id,
          userId: data.userId,
          channelId: data.channelId,
          channelTitle: data.channelTitle,
          thumbnail: data.thumbnail,
          subscriberCount: data.subscriberCount,
          videoCount: data.videoCount,
          description: data.description,
          customUrl: data.customUrl,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || "",
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt || "",
        });
      });
      setCreators(loadedCreators);

      // Calculate onboarding step
      let step = 0;
      if (loadedBoards.length > 0) step = 1;
      if (loadedChats.length > 0) step = 2;
      setOnboardingStep(step);

      // Mock daily streak (would be stored in user profile)
      setDailyStreak(Math.floor(Math.random() * 5) + 1);
    } catch (error) {
      console.error("Failed to load homepage data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function formatDate(dateString: string): string {
    if (!dateString) return "Recently";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  // Landing page for non-authenticated users
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-[#888] mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            V1 Core — Now Available
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-white">
            TubeForge
          </h1>
          <p className="text-xl text-[#888] max-w-2xl mb-8">
            YouTube Intelligence & Content Creation Platform. Find viral content,
            understand its structure, and produce your own version — all in your unique voice.
          </p>
          <div className="flex gap-4">
            <Button size="lg" onClick={() => router.push("/auth/signup")} className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push("/auth/login")} className="border-[#2a2a2a] text-white hover:bg-[#1a1a1a]">
              Sign In
            </Button>
          </div>
        </section>

        {/* Features Preview */}
        <section className="py-20 px-4 bg-[#0a0a0a] border-t border-[#1a1a1a]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12 text-white">What you can do</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: "Discover", desc: "Find viral YouTube content in your niche", detail: "Browse trending videos, filter by niche, and analyze what makes content perform." },
                { title: "Create", desc: "Generate scripts and social posts", detail: "AI-powered script generation in your voice, plus social posts for X, Instagram, and Facebook." },
                { title: "Optimize", desc: "SEO-optimize your videos", detail: "Generate titles, descriptions, tags, and thumbnail ideas to maximize discoverability." },
                { title: "Analyze", desc: "Channel performance insights", detail: "Import your channel, get performance scores, and identify what to double down on." },
              ].map((feature) => (
                <div key={feature.title} className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-5 hover:border-[#3a3a3a] transition-colors">
                  <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-sm text-[#888] mb-3">{feature.desc}</p>
                  <p className="text-xs text-[#666]">{feature.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  // Eden-style Dashboard for authenticated users
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Left Sidebar */}
      <div className="w-64 bg-[#181818] border-r border-[#1a1a1a] flex flex-col h-screen sticky top-0">
        {/* Logo */}
        <div className="p-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-white font-semibold text-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            TubeForge
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <SidebarItem icon="home" label="Home" active onClick={() => router.push("/")} />
          <SidebarItem icon="research" label="Research" onClick={() => router.push("/discover")} />
          <SidebarItem icon="menu" label="Menu" onClick={() => {}} />

          <div className="pt-4 pb-2">
            <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Analyze</p>
          </div>
          <SidebarItem icon="chart" label="Creator Posts" onClick={() => router.push("/creators")} />

          <div className="pt-4 pb-2">
            <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Workspace</p>
          </div>
          <SidebarItem icon="board" label="My First Board" onClick={() => router.push("/boards")} />
          <SidebarItem icon="board" label="My Ideas" onClick={() => router.push("/boards?board=ideas")} />
          {boards.filter(b => b.name !== "My First Board" && b.name !== "My Ideas").slice(0, 3).map((board) => (
            <SidebarItem
              key={board.id}
              icon="board"
              label={board.name}
              onClick={() => router.push(`/boards?board=${board.id}`)}
            />
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-[#1a1a1a] space-y-1">
          <SidebarItem icon="academy" label="Academy" onClick={() => {}} />
          <SidebarItem icon="help" label="Help & Support" onClick={() => {}} />
          {user && (
            <div className="flex items-center gap-2 px-3 py-2 mt-2">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white font-medium">
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </div>
              <span className="text-sm text-[#888] truncate">{user.displayName || user.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">Welcome to Eden</h1>
            <span className="text-xs text-[#666]">Daily streak</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a]">
              <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="text-xs text-white font-medium">{dailyStreak}</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/boards")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Create or find
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
          {/* Getting Started */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Getting started</h2>
              <span className="text-xs text-[#666]">{Math.min(onboardingStep + 1, 3)}/3</span>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-4">
              <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mb-4">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${((onboardingStep + 1) / 3) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <OnboardingStep
                  number={1}
                  title="Set up your brand"
                  description="Create your first board and add content to it"
                  completed={onboardingStep >= 0}
                  onClick={() => router.push("/boards")}
                />
                <OnboardingStep
                  number={2}
                  title="Write a boost"
                  description="Generate your first script or social post"
                  completed={onboardingStep >= 1}
                  onClick={() => router.push("/boards")}
                />
                <OnboardingStep
                  number={3}
                  title="Find creators to study"
                  description="Track creators and analyze their content"
                  completed={onboardingStep >= 2}
                  onClick={() => router.push("/creators")}
                />
              </div>
            </div>
          </section>

          {/* Prompts */}
          <section>
            <h2 className="text-sm font-medium text-[#888] mb-4">Prompts</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <PromptCard
                title="Write a Post"
                description="Generate engaging social posts with angles, format, and tone"
                onClick={() => router.push("/boards")}
              />
              <PromptCard
                title="Carousel Writer"
                description="Create a carousel post with multiple slides"
                onClick={() => router.push("/boards")}
              />
              <PromptCard
                title="Thinking Partner"
                description="Brainstorm ideas and get feedback on your content"
                onClick={() => router.push("/boards")}
              />
            </div>
          </section>

          {/* Recent Chats */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Recent chats</h2>
              <button
                onClick={() => router.push("/boards")}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                New chat
              </button>
            </div>
            {recentChats.length > 0 ? (
              <div className="space-y-2">
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/boards?chat=${chat.id}`)}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{chat.title}</p>
                      {chat.boardName && (
                        <p className="text-xs text-[#666]">{chat.boardName}</p>
                      )}
                    </div>
                    <span className="text-xs text-[#666]">{formatDate(chat.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                <p className="text-sm text-[#666]">No recent chats</p>
                <p className="text-xs text-[#888] mt-1">Start a chat from any board</p>
              </div>
            )}
          </section>

          {/* Creator Cards */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Creators</h2>
              <button
                onClick={() => router.push("/creators")}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                Add creators
              </button>
            </div>
            {creators.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creators.map((creator) => (
                  <button
                    key={creator.id}
                    onClick={() => router.push(`/creators?creator=${creator.id}`)}
                    className="text-left bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {creator.thumbnail ? (
                          <img
                            src={creator.thumbnail}
                            alt={creator.channelTitle}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                            <span className="text-sm text-[#888]">{creator.channelTitle[0]}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-white">{creator.channelTitle}</p>
                          <p className="text-xs text-[#888]">
                            {creator.subscriberCount?.toLocaleString()} subscribers
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-[#666] line-clamp-2">{creator.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                <p className="text-sm text-[#666]">No creators tracked yet</p>
                <button
                  onClick={() => router.push("/creators")}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                >
                  Track your first creator
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Sidebar Item
function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    home: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    brief: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    research: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    menu: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    ),
    chart: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    board: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    academy: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 19.477 5.754 19 7.5 19s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 19.477 18.247 19 16.5 19c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    help: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
        active
          ? "bg-[#1a1a1a] text-white"
          : "text-[#888] hover:bg-[#1a1a1a] hover:text-white"
      }`}
    >
      {iconMap[icon] || iconMap.home}
      <span className="truncate">{label}</span>
    </button>
  );
}

// Onboarding Step
function OnboardingStep({
  number,
  title,
  description,
  completed,
  onClick,
}: {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left flex items-start gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-colors group"
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5 ${
          completed
            ? "bg-green-500/20 text-green-400"
            : "bg-[#2a2a2a] text-[#888] group-hover:bg-[#3a3a3a]"
        }`}
      >
        {completed ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          number
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="text-xs text-[#888]">{description}</p>
      </div>
    </button>
  );
}

// Prompt Card
function PromptCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-white">{title}</p>
      </div>
      <p className="text-xs text-[#888]">{description}</p>
    </button>
  );
}
