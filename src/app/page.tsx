"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { AppSidebar } from "@/components/AppSidebar";
import { ContentChatPanel } from "@/components/discover/ContentChatPanel";
import { LandingPage } from "@/components/landing/LandingPage";
import { useHomePage, formatChatDate } from "@/hooks/useHomePage";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();
  const {
    recentChats,
    chatSessions,
    creators,
    onboardingStep,
    dailyStreak,
  } = useHomePage(user?.uid);

  // Landing page for non-authenticated users
  if (!authLoading && !isAuthenticated) {
    return <LandingPage />;
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] border-t-white animate-spin" />
          <p className="text-xs text-[#666]">Loading…</p>
        </div>
      </div>
    );
  }

  // Eden-style Dashboard for authenticated users
  return (
    <div className="h-screen bg-[#0a0a0a] flex overflow-hidden">
      <AppSidebar
        activeNav="home"
        extraBoards={[]}
        chatSessions={chatSessions}
        onResearchClick={() => router.push("/discover")}
        onWorkspaceClick={(boardId) => router.push(`/discover?workspace=${boardId}`)}
        onChatSessionClick={(sessionId) => {
          setChatSessionId(sessionId);
          setChatOpen(true);
        }}
        onNewChatClick={() => {
          setChatSessionId(undefined);
          setChatOpen(true);
        }}
      />

      {/* Main Content + Chat Split */}
      <div className="flex-1 flex overflow-hidden h-full">
        <div className={`overflow-y-auto ${chatOpen ? 'flex-1' : 'flex-1'}`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a] px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-white">Welcome to Outlierly</h1>
            <span className="text-xs text-[#666] hidden sm:inline">Daily streak</span>
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a]">
              <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              <span className="text-xs text-white font-medium">{dailyStreak}</span>
            </div>
          </div>
          <button
            onClick={() => router.push("/discover")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-sm text-[#ccc] hover:text-white hover:border-[#3a3a3a] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Create or find
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
          {/* Getting Started */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Getting started</h2>
              <span className="text-xs text-[#666]">{Math.min(onboardingStep + 1, 3)}/3</span>
            </div>
            <div className="bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] p-4">
              <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 mb-4 overflow-hidden">
                <div
                  className="bg-emerald-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(((onboardingStep + 1) / 3) * 100, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <OnboardingStep
                  number={1}
                  title="Set up your brand"
                  description="Create your first board and add content to it"
                  completed={onboardingStep >= 1}
                  onClick={() => router.push("/discover")}
                />
                <OnboardingStep
                  number={2}
                  title="Write a boost"
                  description="Generate your first script or social post"
                  completed={onboardingStep >= 2}
                  onClick={() => router.push("/discover")}
                />
                <OnboardingStep
                  number={3}
                  title="Find creators to study"
                  description="Track creators and analyze their content"
                  completed={onboardingStep >= 3}
                  onClick={() => router.push("/discover")}
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
                onClick={() => router.push("/discover")}
              />
              <PromptCard
                title="Carousel Writer"
                description="Create a carousel post with multiple slides"
                onClick={() => router.push("/discover")}
              />
              <PromptCard
                title="Thinking Partner"
                description="Brainstorm ideas and get feedback on your content"
                onClick={() => router.push("/discover")}
              />
            </div>
          </section>

          {/* Recent Chats */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Recent chats</h2>
              <button
                onClick={() => { setChatSessionId(undefined); setChatOpen(true); }}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
              >
                New chat
              </button>
            </div>
            {recentChats.length > 0 ? (
              <div className="space-y-2">
                {recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => { setChatSessionId(chat.id); setChatOpen(true); }}
                    className="w-full text-left flex items-center gap-3 p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{chat.title}</p>
                      {chat.boardName && (
                        <p className="text-xs text-[#666]">{chat.boardName}</p>
                      )}
                    </div>
                    <span className="text-xs text-[#666] shrink-0">{formatChatDate(chat.updatedAt)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                <p className="text-sm text-[#ccc]">No recent chats</p>
                <p className="text-xs text-[#666] mt-1 mb-3">Start a chat to brainstorm ideas</p>
                <button
                  onClick={() => { setChatSessionId(undefined); setChatOpen(true); }}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded px-2 py-1"
                >
                  Start a new chat →
                </button>
              </div>
            )}
          </section>

          {/* Creator Cards */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#888]">Creators</h2>
              <button
                onClick={() => router.push("/discover")}
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded"
              >
                Add creators
              </button>
            </div>
            {creators.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {creators.map((creator) => (
                  <button
                    key={creator.id}
                    onClick={() => router.push(`/discover/creators/${creator.channelId}`)}
                    className="text-left bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] overflow-hidden hover:border-[#3a3a3a] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {creator.thumbnail ? (
                          <Image
                            src={creator.thumbnail}
                            alt={creator.channelTitle}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                            <span className="text-sm text-[#888]">{creator.channelTitle?.[0] ?? "?"}</span>
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
                <p className="text-sm text-[#ccc]">No creators tracked yet</p>
                <p className="text-xs text-[#666] mt-1 mb-3">Find and study creators in your niche</p>
                <button
                  onClick={() => router.push("/discover")}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 rounded px-2 py-1"
                >
                  Track your first creator →
                </button>
              </div>
            )}
          </section>
        </div>
        </div>

        {/* Chat Panel — inline split (right pane) */}
        <ContentChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          sessionId={chatSessionId}
          userId={user?.uid}
          inline={true}
        />
      </div>
    </div>
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
      className="text-left flex items-start gap-3 p-3 rounded-lg hover:bg-[#2a2a2a] transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5 transition-colors ${
          completed
            ? "bg-emerald-400/20 text-emerald-400"
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
      className="text-left p-4 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p className="text-sm font-medium text-white">{title}</p>
      </div>
      <p className="text-xs text-[#888]">{description}</p>
    </button>
  );
}
