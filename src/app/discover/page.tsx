"use client";

import { useState, useEffect, Suspense, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import type { BoardCard } from "@/types/board";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, setDoc, increment } from "firebase/firestore";
import { CategoryPills } from "@/components/discover/CategoryPills";
import { DiscoverContentGrid } from "@/components/discover/DiscoverContentGrid";
import { ContentChatPanel } from "@/components/discover/ContentChatPanel";
import { QuotaExceededError } from "@/components/discover/QuotaExceededError";
import { CreatorListsTab } from "@/components/discover/CreatorListsTab";
import { CreatorsTab } from "@/components/discover/CreatorsTab";
import { FilterDropdown } from "@/components/discover/FilterDropdown";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useBlocklistSync } from "@/hooks/useBlocklistSync";
import { useCategories } from "@/hooks/useCategories";
import { useChatSessions } from "@/hooks/useChatSessions";
import { useDiscoverFilters } from "@/hooks/useDiscoverFilters";
import type { SortOption, ContentType } from "@/hooks/useDiscoverFilters";
import { useBoardSave } from "@/hooks/useBoardSave";
import { useDiscoverData } from "@/hooks/useDiscoverData";
import { useWorkspaceBoard } from "@/hooks/useWorkspaceBoard";
import { useLocalCreators } from "@/hooks/useLocalCreators";
import { useTrackedCreatorVideos } from "@/hooks/useTrackedCreatorVideos";
import { LOADING_SAFETY_TIMEOUT_MS } from "@/lib/discovery/time-periods";
import { plainTextToEditableHtml } from "@/lib/board-content";
import { AppSidebar } from "@/components/AppSidebar";
import { Trash2, MessageSquare, Copy, Plus, BookOpen, FileText } from "lucide-react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChannelAnalytics } from "@/components/channel/ChannelAnalytics";

type ResearchTab = "discover" | "creators" | "lists" | "channel";

// Merge category-search videos with tracked-creator videos, deduping by id.
// Category-search videos win on collision (they carry richer stats: comments,
// description, tags) so creator videos only fill gaps the search didn't surface.
function mergeVideos(searchVideos: VideoWithOutlier[], creatorVideos: VideoWithOutlier[]): VideoWithOutlier[] {
  const seen = new Set<string>();
  const merged: VideoWithOutlier[] = [];
  for (const v of searchVideos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    merged.push(v);
  }
  for (const v of creatorVideos) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    merged.push(v);
  }
  return merged;
}

function DiscoverPageContent() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get("workspace");
  const tabParam = searchParams.get("tab");
  const {
    videos,
    setVideos,
    contentItems,
    setContentItems,
    isLoadingVideos,
    setIsLoadingVideos,
    isLoadingContent,
    setIsLoadingContent,
    error,
    quotaError,
    fromCache,
    fetchCountRef,
    fetchVideos,
    fetchContent,
    handleRetry,
  } = useDiscoverData();
  const { creators: trackedCreators } = useLocalCreators();
  const { creatorVideos, isLoading: isLoadingCreatorVideos } = useTrackedCreatorVideos(trackedCreators);
  // True while any feed source is still loading its first batch
  const isFeedLoading = isLoadingVideos || isLoadingContent || isLoadingCreatorVideos;
  const [activeTab, setActiveTab] = useState<ContentType>("all");
  const [researchTab, setResearchTab] = useState<ResearchTab>(tabParam === "creators" ? "creators" : "discover");
  const [sortBy, setSortBy] = useState<SortOption>("top");
  const [displayCount, setDisplayCount] = useState(24);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const { saveVideo, saveContent } = useBoardSave(user?.uid);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const {
    customCategories,
    setCustomCategories,
    activeCategories,
    setActiveCategories,
    showAddCategory,
    setShowAddCategory,
    hoveredCategory,
    setHoveredCategory,
    newCategory,
    setNewCategory,
    handleAddCategory,
    allCategories,
  } = useCategories();
  const filterRef = useRef<HTMLDivElement>(null);

  const userId = user?.uid;

  // Chat sessions state
  const {
    chatSessions,
    isLoadingChatSessions,
  } = useChatSessions();

  // Workspace board state + handlers
  const {
    activeWorkspace,
    setActiveWorkspace,
    workspaceCards,
    setWorkspaceCards,
    isLoadingWorkspace,
    addMenuOpen,
    setAddMenuOpen,
    cardContextMenu,
    setCardContextMenu,
    rightPane,
    setRightPane,
    loadWorkspaceCards,
    handleDeleteCard,
    handleDuplicateCard,
    handleMoveToBoard,
    handleReferenceToBoard,
  } = useWorkspaceBoard({ user, initialWorkspace: workspaceParam });

  // Chat panel state for discover feed
  const [chatItem, setChatItem] = useState<{ item: VideoWithOutlier | ContentItem; type: "video" | "article"; initialPrompt?: string } | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | undefined>();

  // Card editor state
  const [editingCard, setEditingCard] = useState<BoardCard | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [charCount, setCharCount] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);

  const syncContentFromEditor = useCallback(() => {
    if (editorRef.current) {
      setCharCount(editorRef.current.textContent?.length ?? 0);
    }
  }, []);

  // Set initial editor content when card opens
  useEffect(() => {
    if (editingCard && editorRef.current) {
      editorRef.current.innerHTML = plainTextToEditableHtml(editingCard.content);
      setCharCount(editorRef.current.textContent?.length ?? 0);
    }
  }, [editingCard]);

  function openCardEditor(card: BoardCard) {
    setEditingCard(card);
    setEditTitle(card.title);
    setRightPane(null);
  }

  function closeCardEditor() {
    setEditingCard(null);
    setRightPane(null);
  }

  async function handleSaveCardEdit() {
    if (!editingCard || !user || !activeWorkspace) return;
    const htmlContent = editorRef.current?.innerHTML || "";
    const updatedCard = { ...editingCard, title: editTitle, content: htmlContent, updatedAt: new Date().toISOString() };
    try {
      const cardRef = doc(db, "users", user.uid, "boards", activeWorkspace, "cards", editingCard.id);
      await setDoc(cardRef, {
        title: editTitle,
        content: htmlContent,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setWorkspaceCards((prev) => prev.map((c) => (c.id === editingCard.id ? updatedCard : c)));
      toast.success("Card saved");
    } catch (e) {
      console.error("Save failed:", e);
      toast.error("Failed to save card");
    }
  }

  async function handleCreateAndOpenCard() {
    if (!user || !activeWorkspace) return;
    const cardId = crypto.randomUUID();
    const card: BoardCard = {
      id: cardId,
      boardId: activeWorkspace,
      type: "note",
      x: 0, y: 0, width: 240, height: 160,
      title: "Untitled",
      content: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, "users", user.uid, "boards", activeWorkspace, "cards", cardId), {
        ...card,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid, "boards", activeWorkspace), {
        itemCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Create card Firestore failed, saved locally:", e);
    }
    setWorkspaceCards((prev) => [card, ...prev]);
    openCardEditor(card);
  }

  // Blocklist version — bumps when items are hidden so feeds re-filter
  const blocklistVersion = useBlocklistSync();

  // Filters + derived memos
  const {
    selectedPlatforms,
    setSelectedPlatforms,
    selectedFormat,
    setSelectedFormat,
    selectedLanguage,
    setSelectedLanguage,
    selectedFollowers,
    setSelectedFollowers,
    followerMin,
    setFollowerMin,
    followerMax,
    setFollowerMax,
    selectedOutlier,
    setSelectedOutlier,
    selectedTimePeriod,
    setSelectedTimePeriod,
    showFilters,
    setShowFilters,
    unifiedItems,
    sortedVideos,
    sortedArticles,
  } = useDiscoverFilters({
    videos: mergeVideos(videos, creatorVideos),
    contentItems,
    searchQuery,
    sortBy,
    blocklistVersion,
  });

  // Close filter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterRef.current &&
        !filterRef.current.contains(event.target as Node) &&
        showFilters
      ) {
        setShowFilters(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilters]);

  // Reset the visible-item count when the fetch inputs change (render-phase reset,
  // not an effect, to avoid cascading renders flagged by react-hooks/set-state-in-effect)
  const fetchKey = `${userId}|${selectedTimePeriod}|${selectedCategory}`;
  const [lastFetchKey, setLastFetchKey] = useState(fetchKey);
  if (fetchKey !== lastFetchKey) {
    setLastFetchKey(fetchKey);
    setDisplayCount(24);
  }

  // Initial load: fetch trending content based on selected category
  useEffect(() => {
    if (!userId) return;

    const abortController = new AbortController();
    fetchCountRef.current += 1;

    // When "All" is selected, fetch from top categories for diverse results
    let queries: string[];
    let contentQuery: string;
    if (selectedCategory !== "All") {
      queries = [selectedCategory];
      contentQuery = selectedCategory;
    } else {
      const allCats = [...activeCategories, ...customCategories];
      queries = allCats.length > 0 ? allCats.slice(0, 3) : ["content creation"];
      contentQuery = queries[0]; // content APIs work better with single terms
    }
    fetchVideos({ queries, timePeriod: selectedTimePeriod, abortSignal: abortController.signal });
    fetchContent({ query: contentQuery, timePeriod: selectedTimePeriod, abortSignal: abortController.signal });

    return () => {
      abortController.abort();
    };
  }, [userId, selectedTimePeriod, selectedCategory]);

  // Infinite scroll: load more items when scrolling near bottom
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && !isLoadingVideos && !isLoadingContent && !isLoadingCreatorVideos) {
          setIsLoadingMore(true);
          setDisplayCount((prev) => prev + 16);
          setTimeout(() => setIsLoadingMore(false), 300);
        }
      },
      { threshold: 0.1 }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [isLoadingMore, isLoadingVideos, isLoadingContent, isLoadingCreatorVideos]);

  // Load workspace cards when a workspace board is selected
  useEffect(() => {
    if (activeWorkspace) {
      loadWorkspaceCards(activeWorkspace);
    }
  }, [activeWorkspace, user, loadWorkspaceCards]);

  // Close context menu and add menu on click outside
  useEffect(() => {
    if (!cardContextMenu && !addMenuOpen) return;
    function handleClick() {
      setCardContextMenu(null);
      setAddMenuOpen(false);
    }
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [cardContextMenu, addMenuOpen]);


  // Safety timeout — force-clear loading flags if fetches hang
  useEffect(() => {
    if (!isLoadingVideos && !isLoadingContent && !isLoadingCreatorVideos) return;
    const timer = setTimeout(() => {
      setIsLoadingVideos(false);
      setIsLoadingContent(false);
    }, LOADING_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoadingVideos, isLoadingContent, isLoadingCreatorVideos]);




  function onRetry() {
    handleRetry({
      searchQuery,
      selectedCategory,
      activeCategories,
      customCategories,
      timePeriod: selectedTimePeriod,
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setVideos([]);
    setContentItems([]);
    fetchVideos({ queries: [searchQuery.trim()], timePeriod: selectedTimePeriod });
    fetchContent({ query: searchQuery.trim(), timePeriod: selectedTimePeriod });
  }

  function togglePlatform(platformId: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId) ? prev.filter((p) => p !== platformId) : [...prev, platformId]
    );
  }

  // Auth guard — redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen bg-[#0a0a0a] flex overflow-hidden">
      <AppSidebar
        activeNav={activeWorkspace ? "board" : "research"}
        activeWorkspace={activeWorkspace}
        extraBoards={[]}
        chatSessions={chatSessions}
        isLoadingChatSessions={isLoadingChatSessions}
        onResearchClick={() => { setRightPane(null); setActiveWorkspace(null); }}
        onWorkspaceClick={(boardId) => { setChatItem(null); setChatSessionId(undefined); setActiveWorkspace(boardId); setResearchTab("discover"); }}
        onChatSessionClick={(sessionId) => { setRightPane(null); setChatItem(null); setChatSessionId(sessionId); }}
        onNewChatClick={() => { setRightPane(null); setChatItem(null); setChatSessionId("new"); }}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane — Discover Content */}
        <div className="flex-1 overflow-y-auto min-w-0 scrollbar-hide">
          {activeWorkspace ? (
            /* Workspace Board View */
            <div className="flex-1 flex h-full">
              {/* Board Left Panel */}
              <div className={`flex flex-col ${rightPane ? "flex-1 min-w-0" : "flex-1"}`}>
              {/* Board Header */}
              <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-white">
                  {activeWorkspace === "my-first-board" ? "My First Board" : "My Ideas"}
                </h1>
                {/* Add Button — creates a card directly */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleCreateAndOpenCard(); }}
                  className="w-7 h-7 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                  title="New card"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setChatItem(null); setChatSessionId(undefined); setRightPane({ type: "chat", card: editingCard || undefined }); }} className="px-3 py-1.5 text-sm text-[#888] hover:text-white transition-colors cursor-pointer">Chat</button>
              </div>
            </div>

            {/* Board Content */}
            {editingCard ? (
              /* Full-screen Card Editor */
              <div className="flex-1 flex flex-col">
                {/* Editor Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={closeCardEditor}
                      className="p-1.5 rounded-lg text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <FileText className="w-4 h-4 text-[#666] shrink-0" />
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-transparent text-white font-semibold text-sm focus:outline-none min-w-0 flex-1"
                      placeholder="Untitled"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#555] tabular-nums">
                      {charCount} chars
                    </span>
                    <button
                      onClick={() => {
                        handleDeleteCard(editingCard.id);
                        closeCardEditor();
                      }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleSaveCardEdit}
                        className="px-4 py-1.5 text-sm font-medium bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                  </div>
                </div>
                {/* Formatting Toolbar */}
                <div className="flex items-center gap-0.5 px-5 py-1.5 border-b border-[#1a1a1a] shrink-0">
                  <button
                    onClick={() => document.execCommand("bold")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs font-bold text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Bold (Ctrl+B)"
                  >B</button>
                  <button
                    onClick={() => document.execCommand("italic")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs italic text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Italic (Ctrl+I)"
                  >I</button>
                  <button
                    onClick={() => document.execCommand("underline")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs underline text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Underline (Ctrl+U)"
                  >U</button>
                  <button
                    onClick={() => document.execCommand("strikeThrough")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs line-through text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Strikethrough"
                  >S</button>
                  <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
                  <button
                    onClick={() => document.execCommand("formatBlock", false, "h1")}
                    className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-semibold text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Heading 1"
                  >H1</button>
                  <button
                    onClick={() => document.execCommand("formatBlock", false, "h2")}
                    className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-semibold text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Heading 2"
                  >H2</button>
                  <button
                    onClick={() => document.execCommand("formatBlock", false, "h3")}
                    className="w-7 h-7 flex items-center justify-center rounded text-[11px] font-semibold text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Heading 3"
                  >H3</button>
                  <button
                    onClick={() => document.execCommand("formatBlock", false, "p")}
                    className="w-7 h-7 flex items-center justify-center rounded text-[11px] text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Paragraph"
                  >P</button>
                  <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
                  <button
                    onClick={() => document.execCommand("insertUnorderedList")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Bullet list"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => document.execCommand("insertOrderedList")}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Numbered list"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 6h14M7 12h14M7 18h14M4 6h.01M4 12h.01M4 18h.01" />
                    </svg>
                  </button>
                  <div className="w-px h-4 bg-[#2a2a2a] mx-1" />
                  <button
                    onClick={() => {
                      document.execCommand("formatBlock", false, "blockquote");
                      editorRef.current?.focus();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Blockquote"
                  >&ldquo;</button>
                  <button
                    onClick={() => {
                      document.execCommand("insertHTML", false, "<hr>");
                      editorRef.current?.focus();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Horizontal rule"
                  >&mdash;</button>
                  <button
                    onClick={() => {
                      const url = prompt("Enter URL:");
                      if (url) {
                        try {
                          const parsed = new URL(url, window.location.origin);
                          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
                            toast.error("Only http and https links are allowed");
                            return;
                          }
                          document.execCommand("createLink", false, parsed.href);
                        } catch {
                          toast.error("Invalid URL");
                        }
                      }
                      editorRef.current?.focus();
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded text-xs text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                    title="Insert link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m0-5.656a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
                    </svg>
                  </button>
                </div>
                {/* Editor Body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-8">
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncContentFromEditor}
                    onBlur={syncContentFromEditor}
                    className="w-full min-h-[calc(100vh-260px)] bg-transparent text-[15px] text-[#ccc] placeholder:text-[#555] focus:outline-none leading-relaxed [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-white [&>h1]:mb-3 [&>h1]:mt-6 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:text-white [&>h2]:mb-2 [&>h2]:mt-5 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-white [&>h3]:mb-2 [&>h3]:mt-4 [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-3 [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-3 [&>li]:mb-1 [&>blockquote]:border-l-2 [&>blockquote]:border-[#3a3a3a] [&>blockquote]:pl-4 [&>blockquote]:text-[#999] [&>blockquote]:my-3 [&>hr]:border-[#2a2a2a] [&>hr]:my-4 [&>a]:text-emerald-400 [&>a]:underline [&>b]:font-bold [&>strong]:font-bold [&>i]:italic [&>em]:italic [&>u]:underline [&>s]:line-through [&>del]:line-through"
                    data-placeholder="Start writing..."
                  />
                  <style jsx>{`
                    [data-placeholder]:empty:before {
                      content: attr(data-placeholder);
                      color: #555;
                      pointer-events: none;
                    }
                  `}</style>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-6">
              {isLoadingWorkspace ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              ) : (
                <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
                  {workspaceCards.map((card) => (
                    <div
                      key={card.id}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCardContextMenu({ card, x: e.clientX, y: e.clientY });
                      }}
                      onClick={() => openCardEditor(card)}
                      className="break-inside-avoid bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors cursor-pointer"
                    >
                      <h3 className="text-sm font-medium text-white">{card.title}</h3>
                      {card.content && <p className="text-xs text-[#888] mt-2 whitespace-pre-wrap line-clamp-6 break-words">{card.content}</p>}
                      {card.url && <p className="text-xs text-emerald-400 mt-2 truncate">{card.url}</p>}
                      <p className="text-[10px] text-[#555] mt-3">
                        {new Date(card.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              </div>
            )}
            </div>{/* end Board Left Panel */}

            {/* Right Pane - Split Screen */}
            {rightPane && rightPane.type === "info" && (
              <div className="w-[480px] border-l border-[#1a1a1a] flex flex-col h-full bg-[#0a0a0a]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
                  <span className="text-sm text-[#888]">New chat</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setRightPane(null)} className="w-7 h-7 flex items-center justify-center rounded-md text-[#888] hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <h1 className="text-2xl font-bold text-white mb-4">Welcome to Outlierly</h1>
                  <p className="text-sm text-[#888] mb-6">Your workspace for ideas.<br />This is a document, and it lives inside a board.</p>
                  <h2 className="text-lg font-semibold text-white mb-3">What you can do with boards</h2>
                  <ul className="text-sm text-[#888] space-y-2 mb-6 list-disc list-inside">
                    <li>Write content, newsletters, scripts, and more</li>
                    <li>Add social posts, links, PDFs, and raw ideas</li>
                    <li>Chat with a single item, or with the whole board at once</li>
                  </ul>
                  <h2 className="text-lg font-semibold text-white mb-3">Why boards</h2>
                  <p className="text-sm text-[#888] mb-6">Think of a board as a curated home for a project. You&apos;ll find ideas in the Discover tab, the Creators tab, in chat, and in your weekly brief — but boards are where you organize them and keep them safe.</p>
                  <h2 className="text-lg font-semibold text-white mb-3">Not sure where to start?</h2>
                  <p className="text-sm text-[#888] mb-6">Use boards for the projects you already work on. A simple system: make one board each week and drop that week&apos;s content and ideas inside. It keeps everything organized without much effort.</p>
                  <h2 className="text-lg font-semibold text-white mb-3">Need a hand?</h2>
                  <p className="text-sm text-[#888]">Join our Discord to talk branding, content, and ideas with other Outlierly creators: <span className="text-emerald-400">discord.gg/edendotso</span></p>
                  <p className="text-sm text-[#888] mt-2">Run into a problem? Email us anytime at support@eden.so</p>
                </div>
              </div>
            )}

            {rightPane && rightPane.type === "chat" && (
              <div className="w-[550px] border-l border-[#1a1a1a] h-full bg-[#0a0a0a] overflow-hidden shrink-0">
                <ContentChatPanel
                  isOpen={true}
                  onClose={() => setRightPane(null)}
                  card={rightPane.card ?? editingCard ?? undefined}
                  userId={user?.uid}
                  inline={true}
                />
              </div>
            )}

            {/* Card Context Menu */}
            {cardContextMenu && (
              <div
                className="fixed z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl py-1.5 w-56"
                style={{
                  top: Math.min(cardContextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 768) - 320),
                  left: Math.min(cardContextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1024) - 240),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {activeWorkspace === "my-ideas" ? (
                  /* My Ideas context menu */
                  <>
                    <button onClick={() => { setChatItem(null); setChatSessionId(undefined); if (!(rightPane?.type === "chat" && rightPane?.card?.id === cardContextMenu.card.id)) setRightPane({ type: "chat", card: cardContextMenu.card }); setCardContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <MessageSquare className="w-4 h-4" />
                      <span>Chat with</span>
                    </button>
                    <div className="my-1 border-t border-[#2a2a2a]" />
                    <button onClick={() => handleDuplicateCard(cardContextMenu.card)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <Copy className="w-4 h-4" />
                      <span>Duplicate to Board</span>
                    </button>
                    <div className="my-1 border-t border-[#2a2a2a]" />
                    <button onClick={() => handleDeleteCard(cardContextMenu.card.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                ) : (
                  /* My First Board context menu */
                  <>
                    <button onClick={() => { setRightPane({ type: "info", card: cardContextMenu.card }); setCardContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" /></svg>
                      <span>Open in Pane</span>
                      <span className="ml-auto text-xs text-[#666]">Alt ⇧</span>
                    </button>
                    <button onClick={() => { setChatItem(null); setChatSessionId(undefined); if (!(rightPane?.type === "chat" && rightPane?.card?.id === cardContextMenu.card.id)) setRightPane({ type: "chat", card: cardContextMenu.card }); setCardContextMenu(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 14.583 3 13.303 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span>Chat with</span>
                    </button>
                    <div className="my-1 border-t border-[#2a2a2a]" />
                    <button onClick={() => handleDuplicateCard(cardContextMenu.card)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                      <span>Duplicate to Board</span>
                    </button>
                    <button onClick={() => handleMoveToBoard(cardContextMenu.card)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                      <span>Move to Board</span>
                    </button>
                    <button onClick={() => handleReferenceToBoard(cardContextMenu.card)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#ccc] hover:bg-[#2a2a2a] hover:text-white transition-colors cursor-pointer">
                      <BookOpen className="w-4 h-4" />
                      <span>Reference on Board</span>
                    </button>
                    <div className="my-1 border-t border-[#2a2a2a]" />
                    <button onClick={() => handleDeleteCard(cardContextMenu.card.id)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors cursor-pointer">
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        ) : (
        <>
        {/* Top Search Bar */}
        <div className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-[#1a1a1a] px-6 py-3">
          <div className="flex items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search videos, articles, creators..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-32 py-2.5 text-sm text-white placeholder-[#666] focus:outline-none focus:border-[#3a3a3a] transition-colors"
                />
                {/* Filter button inside search input */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#2a2a2a] hover:bg-[#3a3a3a] transition-colors text-xs text-[#ccc] hover:text-white cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span>Filters</span>
                  <svg className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </form>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              disabled={isFeedLoading}
              className="text-[#888] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className={`w-4 h-4 ${isFeedLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </div>

          {showFilters && (
            <FilterDropdown
              filterRef={filterRef}
              selectedPlatforms={selectedPlatforms}
              setSelectedPlatforms={setSelectedPlatforms}
              togglePlatform={togglePlatform}
              selectedFormat={selectedFormat}
              setSelectedFormat={setSelectedFormat}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
              selectedFollowers={selectedFollowers}
              setSelectedFollowers={setSelectedFollowers}
              followerMin={followerMin}
              setFollowerMin={setFollowerMin}
              followerMax={followerMax}
              setFollowerMax={setFollowerMax}
              selectedOutlier={selectedOutlier}
              setSelectedOutlier={setSelectedOutlier}
              selectedTimePeriod={selectedTimePeriod}
              setSelectedTimePeriod={setSelectedTimePeriod}
            />
          )}
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Research Tabs */}
          <div className="flex items-center gap-6 mb-4">
            {([
              { id: "discover" as ResearchTab, label: "Discover" },
              { id: "creators" as ResearchTab, label: "Creators" },
              { id: "lists" as ResearchTab, label: "Lists" },
              { id: "channel" as ResearchTab, label: "Channel" },
            ]).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setResearchTab(tab.id)}
                className={`text-lg font-medium pb-1 border-b-2 transition-colors cursor-pointer ${
                  researchTab === tab.id
                    ? "text-white border-white"
                    : "text-[#666] border-transparent hover:text-[#888]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Category Pills - only show on Discover */}
          {researchTab === "discover" && (
            <CategoryPills
              categories={allCategories}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              hoveredCategory={hoveredCategory}
              onHover={setHoveredCategory}
              onRemove={(category) => {
                setActiveCategories((prev) => prev.filter((c) => c !== category));
                setCustomCategories((prev) => prev.filter((c) => c !== category));
                if (selectedCategory === category) {
                  setSelectedCategory("All");
                }
              }}
              showAdd={showAddCategory}
              onShowAdd={() => setShowAddCategory(true)}
              onCancelAdd={() => {
                setShowAddCategory(false);
                setNewCategory("");
              }}
              newCategory={newCategory}
              onNewCategoryChange={setNewCategory}
              onAddCategory={handleAddCategory}
            />
          )}

          {/* ===== DISCOVER TAB ===== */}
          {researchTab === "discover" && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md p-0.5">
                  {(["all", "videos", "articles"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 text-xs rounded transition-colors capitalize cursor-pointer ${
                        activeTab === tab ? "bg-[#2a2a2a] text-white" : "text-[#888] hover:text-white"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="text-sm border border-[#2a2a2a] rounded-md px-3 py-1.5 bg-[#1a1a1a] text-white focus:outline-none focus:border-[#3a3a3a] cursor-pointer transition-colors"
                >
                  <option value="top">Best Performance</option>
                  <option value="discovery">Discovery Score</option>
                  <option value="trending">Trending</option>
                  <option value="recent">Most Recent</option>
                  <option value="discussed">Most Discussed</option>
                </select>
              </div>

              {/* Quota Error */}
              {quotaError && (
                <div className="mb-6">
                  <QuotaExceededError
                    retryAfter={quotaError.retryAfter}
                    onRetry={onRetry}
                    hasCachedResults={fromCache && (unifiedItems.length > 0 || videos.length > 0 || contentItems.length > 0)}
                  />
                </div>
              )}

              {/* Error */}
              {error && !quotaError && videos.length === 0 && contentItems.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8 mb-6">
                  <div className="flex flex-col items-center text-center">
                    <svg className="text-[#666] mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" x2="12" y1="8" y2="12" />
                      <line x1="12" x2="12.01" y1="16" y2="16" />
                    </svg>
                    <p className="text-base font-medium text-white mb-2">Something went wrong</p>
                    <p className="text-sm text-[#888] mb-4">{error}</p>
                    <Button variant="outline" size="sm" onClick={onRetry} className="bg-[#1a1a1a] border-[#2a2a2a] text-white hover:bg-[#252525] hover:border-[#3a3a3a]">
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isFeedLoading && videos.length === 0 && contentItems.length === 0 && creatorVideos.length === 0 && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="break-inside-avoid mb-4">
                      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                        <CardContent className="p-3">
                          <div className="w-full h-32 bg-[#252525] animate-pulse rounded mb-3" />
                          <div className="w-3/4 h-3 bg-[#252525] animate-pulse rounded mb-2" />
                          <div className="w-1/2 h-3 bg-[#252525] animate-pulse rounded" />
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}

              {/* Masonry Content Grid */}
              {activeTab === "all" && (
                <DiscoverContentGrid
                  mixed={unifiedItems}
                  displayCount={displayCount}
                  loadMoreRef={loadMoreRef}
                  onVideoSave={saveVideo}
                  onContentSave={saveContent}
                  onChatOpen={(chatItem) => { setChatSessionId(undefined); setChatItem(chatItem); }}
                />
              )}

              {activeTab === "videos" && (
                <DiscoverContentGrid
                  videos={sortedVideos}
                  displayCount={displayCount}
                  loadMoreRef={loadMoreRef}
                  onVideoSave={saveVideo}
                  onContentSave={saveContent}
                  onChatOpen={(chatItem) => { setChatSessionId(undefined); setChatItem(chatItem); }}
                />
              )}

              {activeTab === "articles" && (
                <DiscoverContentGrid
                  articles={sortedArticles}
                  displayCount={displayCount}
                  loadMoreRef={loadMoreRef}
                  onVideoSave={saveVideo}
                  onContentSave={saveContent}
                  onChatOpen={(chatItem) => { setChatSessionId(undefined); setChatItem(chatItem); }}
                />
              )}

              {/* Empty */}
              {!isFeedLoading && videos.length === 0 && contentItems.length === 0 && creatorVideos.length === 0 && !error && !quotaError && (
                <div className="rounded-lg border border-dashed border-[#2a2a2a] bg-[#0a0a0a]/50 p-8">
                  <div className="flex flex-col items-center text-center">
                    <svg className="text-[#666] mb-4" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" x2="16.65" y1="21" y2="16.65" />
                    </svg>
                    <p className="text-base font-medium text-white mb-2">Nothing to show yet</p>
                    <p className="text-sm text-[#888] mb-4">
                      {user ? "Select a category, adjust filters, or search to discover content." : "Sign in to discover content."}
                    </p>
                    {user && (
                      <Button variant="outline" size="sm" onClick={onRetry} className="bg-[#1a1a1a] border-[#2a2a2a] text-white hover:bg-[#252525] hover:border-[#3a3a3a]">
                        Load content
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== CREATORS TAB ===== */}
          {researchTab === "creators" && <CreatorsTab user={user} />}

          {/* ===== LISTS TAB ===== */}
          {researchTab === "lists" && <CreatorListsTab onChatOpen={(video, prompt) => { setChatSessionId(undefined); setChatItem({ item: video, type: "video", initialPrompt: prompt }); }} />}

          {/* ===== CHANNEL TAB ===== */}
          {researchTab === "channel" && (
            <div className="mt-2">
              <ChannelAnalytics />
            </div>
          )}
        </div>
        </>
        )}
      </div>

        {/* Unified Chat Panel — inline split (right pane) */}
        {(!!chatSessionId || !!chatItem) && (
        <div className="w-[550px] shrink-0 h-full">
          <ContentChatPanel
            isOpen={true}
            onClose={() => { setChatSessionId(undefined); setChatItem(null); }}
            sessionId={chatSessionId === "new" ? undefined : chatSessionId}
            userId={user?.uid}
            item={chatItem?.item}
            itemType={chatItem?.type}
            initialPrompt={chatItem?.initialPrompt}
            inline={true}
          />
        </div>
        )}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
          </div>
        }
      >
        <DiscoverPageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
