"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { logOut } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChatSessionsModal } from "@/components/chat/ChatSessionsModal";
import { LLM_PROVIDERS, getSavedLlmConfig, resolveProviderConfig, saveLlmConfig, clearLlmConfig } from "@/lib/llm-config";
import { Plus } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  updatedAt?: string;
}

interface BoardItem {
  id: string;
  name: string;
}

interface AppSidebarProps {
  /** Which nav item is active: "home" | "research" | "chat" | "board" */
  activeNav?: string;
  /** Extra board items to show under Workspace (beyond the static ones) */
  extraBoards?: BoardItem[];
  /** Active workspace board id, if any */
  activeWorkspace?: string | null;
  /** Chat sessions for the Chat dropdown */
  chatSessions?: ChatSession[];
  /** Whether chat sessions are loading */
  isLoadingChatSessions?: boolean;
  /** Called when a chat session is clicked */
  onChatSessionClick?: (sessionId: string) => void;
  /** Called when "+ New Chat" is clicked */
  onNewChatClick?: () => void;
  /** Called when a workspace board is clicked */
  onWorkspaceClick?: (boardId: string) => void;
  /** Called when Research nav is clicked */
  onResearchClick?: () => void;
}

const MAX_VISIBLE_SESSIONS = 5;

export function AppSidebar({
  activeNav,
  extraBoards = [],
  activeWorkspace,
  chatSessions = [],
  isLoadingChatSessions = false,
  onChatSessionClick,
  onNewChatClick,
  onWorkspaceClick,
  onResearchClick,
}: AppSidebarProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [sessionsModalOpen, setSessionsModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    setNotificationsEnabled(localStorage.getItem("notifications_enabled") !== "false");
    setAutoRefresh(localStorage.getItem("auto_refresh") === "true");
  }, []);

  const savedConfig = getSavedLlmConfig();
  const [llmProvider, setLlmProvider] = useState(savedConfig?.provider || "kimi");
  const [llmApiKey, setLlmApiKey] = useState(savedConfig?.apiKey || "");
  const savedPreset = LLM_PROVIDERS.find((p) => p.id === savedConfig?.provider);
  const [llmEndpoint, setLlmEndpoint] = useState(
    savedConfig?.apiEndpoint || savedPreset?.endpoint || ""
  );
  const [llmModel, setLlmModel] = useState(
    savedConfig?.model || savedPreset?.model || ""
  );
  const [llmSaved, setLlmSaved] = useState(!!savedConfig?.apiKey);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string }[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

  const visibleSessions = chatSessions.slice(0, MAX_VISIBLE_SESSIONS);
  const hasMoreSessions = chatSessions.length > MAX_VISIBLE_SESSIONS;

  async function handleLogout() {
    try {
      await logOut();
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      toast.error("Failed to log out. Please try again.");
    }
  }

  async function handleFetchModels() {
    if (!llmApiKey.trim()) {
      toast.error("Please enter an API key first");
      return;
    }
    setFetchingModels(true);
    try {
      const res = await fetch("/api/llm/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: llmProvider, apiKey: llmApiKey.trim(), endpoint: llmEndpoint }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Failed to fetch models");
        return;
      }
      setAvailableModels(data.data || []);
      if (data.data?.some((m: { id: string }) => m.id === llmModel)) {
        // keep current selection
      } else if (data.data && data.data.length > 0) {
        setLlmModel(data.data[0].id);
      }
      toast.success(`Loaded ${data.data?.length || 0} models`);
    } catch {
      toast.error("Failed to fetch models");
    } finally {
      setFetchingModels(false);
    }
  }

  function handleResearchClick() {
    if (onResearchClick) {
      onResearchClick();
    } else {
      router.push("/discover");
    }
  }

  function handleChatSessionClick(sessionId: string) {
    if (onChatSessionClick) {
      onChatSessionClick(sessionId);
    } else {
      router.push(`/discover?chatSession=${sessionId}`);
    }
  }

  function handleNewChatClick() {
    if (onNewChatClick) {
      onNewChatClick();
    } else {
      router.push("/discover");
    }
  }

  function handleWorkspaceClick(boardId: string) {
    if (onWorkspaceClick) {
      onWorkspaceClick(boardId);
    } else {
      router.push(`/discover?workspace=${boardId}`);
    }
  }

  return (
    <>
      <div className="w-56 bg-[#181818] border-r border-[#2a2a2a] flex flex-col h-screen sticky top-0 shrink-0 mx-auto hidden md:flex">
      {/* Logo */}
      <div className="p-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white font-semibold text-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] rounded-md cursor-pointer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Outlierly
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <SidebarItem icon="home" label="Home" active={activeNav === "home"} onClick={() => router.push("/")} />
        <SidebarItem icon="research" label="Research" active={activeNav === "research"} onClick={handleResearchClick} />

        {/* Analyze section */}
        <div className="pt-4 pb-2">
          <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Analyze</p>
        </div>

        {/* Chat Nav — hover shows + button, no dropdown */}
        <NavWithAction
          icon="chat"
          label="Chat"
          active={activeNav === "chat"}
          onClick={handleNewChatClick}
          actionIcon={<Plus className="w-3.5 h-3.5" />}
          actionLabel="New chat"
          onAction={handleNewChatClick}
        />

        {/* Chat sessions under Chat nav */}
        {isLoadingChatSessions ? (
          <div className="ml-4 py-1">
            <div className="w-3 h-3 border-2 border-[#3a3a3a] border-t-[#888] rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            {visibleSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleChatSessionClick(session.id)}
                className="w-full text-left pl-9 pr-2 py-1.5 rounded-md text-xs text-[#888] hover:text-white transition-colors truncate cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a]"
              >
                {session.title}
              </button>
            ))}
            {hasMoreSessions && (
              <button
                onClick={() => setSessionsModalOpen(true)}
                className="w-full text-left pl-9 pr-2 py-1.5 rounded-md text-xs text-[#666] hover:text-[#ccc] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a]"
              >
                Show more ({chatSessions.length - MAX_VISIBLE_SESSIONS} more)
              </button>
            )}
          </>
        )}

        {/* Workspace section */}
        <div className="pt-4 pb-2">
          <p className="text-xs text-[#666] px-3 uppercase tracking-wider font-medium">Workspace</p>
        </div>
        <SidebarItem
          icon="board"
          label="My Ideas"
          active={activeWorkspace === "my-ideas"}
          onClick={() => handleWorkspaceClick("my-ideas")}
        />
        {extraBoards
          .filter((b) => b.name !== "My First Board" && b.name !== "My Ideas")
          .slice(0, 3)
          .map((board) => (
            <SidebarItem
              key={board.id}
              icon="board"
              label={board.name}
              active={activeWorkspace === board.id}
              onClick={() => handleWorkspaceClick(board.id)}
            />
          ))}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-[#2a2a2a] space-y-1">
        <div className="flex items-center justify-between">
          {user && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#1a1a1a] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer min-w-0"
            >
              <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs text-white font-medium shrink-0">
                {user.displayName?.[0] || user.email?.[0] || "U"}
              </div>
              <span className="text-sm text-[#888] truncate">{user.displayName || user.email}</span>
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-md text-[#888] hover:bg-[#1a1a1a] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    {/* Chat Sessions Modal */}
    <ChatSessionsModal
      isOpen={sessionsModalOpen}
      onClose={() => setSessionsModalOpen(false)}
      sessions={chatSessions}
      onSessionClick={handleChatSessionClick}
    />

    {/* Settings Modal */}
    {settingsOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setSettingsOpen(false)}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="relative w-full max-w-3xl bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Settings</h3>
            <button onClick={() => setSettingsOpen(false)} className="p-1.5 hover:bg-[#2a2a2a] rounded-lg transition-colors text-[#888] hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-4 mb-4 p-3 bg-[#101010] rounded-lg border border-[#2a2a2a]">
            <div className="w-10 h-10 rounded-full bg-[#2a2a2a] flex items-center justify-center text-sm text-white font-semibold shrink-0">
              {user?.displayName?.[0] || user?.email?.[0] || "U"}
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{user?.displayName || "User"}</p>
              <p className="text-xs text-[#888] truncate">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* LLM Provider Configuration */}
            <div className="p-3 bg-[#101010] rounded-lg border border-[#2a2a2a] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-white font-medium">AI Provider</p>
                {llmSaved && (
                  <span className="text-xs bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">Active</span>
                )}
              </div>

              {/* Provider Select */}
              <div>
                <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">Provider</label>
                <select
                  value={llmProvider}
                  onChange={(e) => {
                    const newProvider = e.target.value;
                    const preset = LLM_PROVIDERS.find((p) => p.id === newProvider);
                    setLlmProvider(newProvider);
                    setLlmEndpoint(preset?.endpoint || "");
                    setLlmModel(preset?.model || "");
                    setLlmSaved(false);
                    setAvailableModels([]);
                  }}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3a3a3a] transition-colors cursor-pointer"
                >
                  {LLM_PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* API Key */}
              <div>
                <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">API Key</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={llmApiKey}
                    onChange={(e) => { setLlmApiKey(e.target.value); setLlmSaved(false); }}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                  />
                  {llmApiKey && (
                    <button
                      onClick={() => { setLlmApiKey(""); setLlmSaved(false); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#ccc]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Endpoint URL — editable for openai, anthropic, openrouter. Fixed for kimi. */}
              <div>
                <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">Endpoint URL</label>
                <input
                  type="text"
                  placeholder="https://api.openai.com/v1/chat/completions"
                  value={llmEndpoint}
                  onChange={(e) => { setLlmEndpoint(e.target.value); setLlmSaved(false); }}
                  disabled={llmProvider === "kimi"}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                />
                {llmProvider === "kimi" && (
                  <p className="text-[10px] text-[#555] mt-1">Fixed endpoint for Kimi provider</p>
                )}
              </div>

              {/* Fetch Models button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFetchModels}
                  disabled={fetchingModels}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {fetchingModels ? (
                    <>
                      <div className="w-3 h-3 border-2 border-[#666] border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Fetch models
                    </>
                  )}
                </button>
                {availableModels.length > 0 && (
                  <span className="text-xs text-[#666]">{availableModels.length} available</span>
                )}
              </div>

              {/* Model selection — custom searchable dropdown */}
              {availableModels.length > 0 ? (
                <div className="relative">
                  <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">Model</label>
                  <button
                    onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#3a3a3a] transition-colors cursor-pointer font-mono text-left flex items-center justify-between"
                  >
                    <span className="truncate">{llmModel || "Select model..."}</span>
                    <svg className="w-4 h-4 text-[#666] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {modelDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 overflow-hidden">
                      <div className="p-2 border-b border-[#1a1a1a]">
                        <input
                          type="text"
                          placeholder="Search models..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors font-mono"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto scrollbar-hide">
                        {availableModels
                          .filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()))
                          .map((m) => (
                            <button
                              key={m.id}
                              onClick={() => { setLlmModel(m.id); setLlmSaved(false); setModelDropdownOpen(false); setModelSearch(""); }}
                              className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${llmModel === m.id ? "bg-[#2a2a2a] text-white" : "text-[#888] hover:bg-[#1a1a1a] hover:text-white"}`}
                            >
                              {m.id}
                            </button>
                          ))}
                        {availableModels.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-[#666]">No models found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">Model ID</label>
                  <input
                    type="text"
                    placeholder="gpt-4o"
                    value={llmModel}
                    onChange={(e) => { setLlmModel(e.target.value); setLlmSaved(false); }}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors font-mono"
                  />
                </div>
              )}

              {/* Save / Clear buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!llmApiKey.trim()) {
                      toast.error("Please enter an API key");
                      return;
                    }
                    const config = resolveProviderConfig(llmProvider, llmApiKey.trim(), llmEndpoint, llmModel);
                    saveLlmConfig(config);
                    document.cookie = `tubeforge_llm_config=${encodeURIComponent(JSON.stringify(config))}; path=/; max-age=31536000; SameSite=Lax`;
                    setLlmSaved(true);
                    toast.success("AI provider saved");
                  }}
                  className="flex-1 py-2 text-sm font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/20 transition-colors cursor-pointer"
                >
                  Save
                </button>
                {llmSaved && (
                  <button
                    onClick={() => {
                      clearLlmConfig();
                      document.cookie = "tubeforge_llm_config=; path=/; max-age=0";
                      setLlmApiKey("");
                      setLlmProvider("kimi");
                      setLlmEndpoint(LLM_PROVIDERS[0].endpoint);
                      setLlmModel(LLM_PROVIDERS[0].model);
                      setAvailableModels([]);
                      setLlmSaved(false);
                      toast.success("AI provider cleared — using server default");
                    }}
                    className="py-2 px-3 text-sm text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Notifications */}
            <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#2a2a2a]">
              <div>
                <p className="text-sm text-white font-medium">Notifications</p>
                <p className="text-xs text-[#888]">Get updates on your content</p>
              </div>
              <button
                onClick={() => {
                  const next = !notificationsEnabled;
                  localStorage.setItem("notifications_enabled", String(next));
                  setNotificationsEnabled(next);
                }}
                className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${notificationsEnabled ? "bg-emerald-400" : "bg-[#2a2a2a]"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${notificationsEnabled ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>

            {/* Auto-refresh */}
            <div className="flex items-center justify-between p-3 bg-[#101010] rounded-lg border border-[#2a2a2a]">
              <div>
                <p className="text-sm text-white font-medium">Auto-refresh Data</p>
                <p className="text-xs text-[#888]">Refresh channel data on load</p>
              </div>
              <button
                onClick={() => {
                  const next = !autoRefresh;
                  localStorage.setItem("auto_refresh", String(next));
                  setAutoRefresh(next);
                }}
                className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${autoRefresh ? "bg-emerald-400" : "bg-[#2a2a2a]"}`}
              >
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${autoRefresh ? "right-0.5" : "left-0.5"}`} />
              </button>
            </div>
          </div>

          {/* Voice Profile */}
          <div className="pt-4 mt-4 border-t border-[#2a2a2a] space-y-2">
            <button
              onClick={() => { setSettingsOpen(false); router.push("/voice"); }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#252525] transition-colors text-white text-sm"
            >
              <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H6m4 0h4m-4 0v-1m4 1v-1m-10-1l.3-.3a8 8 0 0010.2-.86M4.3 19.7l.7-.7m13.3 1.4l-.7-.7" />
              </svg>
              Voice Profile
            </button>
          </div>

          {/* Danger zone */}
          <div className="pt-4 mt-4 border-t border-[#2a2a2a] space-y-2">
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              className="w-full p-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg border border-red-500/20 transition-colors"
            >
              Clear All Local Data
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-red-500/10 transition-colors text-red-400 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Log out
            </button>
          </div>
          <p className="text-xs text-[#666] text-center mt-4">Version 0.1.0 · Outlierly</p>
        </div>
      </div>
    )}

    {/* More Menu Modal — for discover page */}
    {moreMenuOpen && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={() => setMoreMenuOpen(false)}>
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-white mb-4">More</h3>
          <div className="space-y-2">
            {/* Additional menu items can go here */}
          </div>
        </div>
      </div>
    )}
  </>
  );
}

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
    chat: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer",
        active
          ? "bg-[#1a1a1a] text-white border-[#3a3a3a]"
          : "text-[#888] hover:bg-[#1a1a1a] hover:text-white border-transparent"
      )}
    >
      {iconMap[icon] || iconMap.home}
      <span className="truncate">{label}</span>
    </button>
  );
}

function NavWithAction({
  icon,
  label,
  active,
  onClick,
  actionIcon,
  actionLabel,
  onAction,
}: {
  icon: string;
  label: string;
  active?: boolean;
  onClick: () => void;
  actionIcon: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  const iconMap: Record<string, React.ReactNode> = {
    chat: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] cursor-pointer relative",
        active
          ? "bg-[#1a1a1a] text-white border-[#3a3a3a]"
          : "text-[#888] hover:bg-[#1a1a1a] hover:text-white border-transparent"
      )}
    >
      {iconMap[icon] || null}
      <span className="truncate">{label}</span>
      <span
        onClick={(e) => {
          e.stopPropagation();
          onAction();
        }}
        className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-[#2a2a2a]"
        title={actionLabel}
        aria-label={actionLabel}
      >
        {actionIcon}
      </span>
    </button>
  );
}
