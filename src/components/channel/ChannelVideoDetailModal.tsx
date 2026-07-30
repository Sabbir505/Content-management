"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCompactNumber, formatDateLongRelative } from "@/lib/format";
import {
  type ChannelVideo,
  type ChannelStats,
  getScoreColorClass,
  getGrade,
} from "@/lib/channel-analytics";
import { useVideoBoost } from "@/hooks/useVideoBoost";
import Image from "next/image";

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 px-2 py-1 text-xs text-[#888] hover:text-white border border-[#2a2a2a] rounded-md hover:border-[#3a3a3a] transition-colors"
      title={label || "Copy"}
    >
      {copied ? (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
      ) : (
        <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label || "Copy"}</>
      )}
    </button>
  );
}

function ScoreBadge({ score, grade }: { score: number; grade: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${getScoreColorClass(score)}`}>
      {grade} · {score}/100
    </span>
  );
}

interface AnalysisSectionProps {
  score: number;
  feedback: string;
  suggestions: string[];
}

function AnalysisSection({ score, feedback, suggestions }: AnalysisSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ScoreBadge score={score} grade={getGrade(score)} />
      </div>
      <p className="text-sm text-[#ccc]">{feedback}</p>
      {suggestions.length > 0 && (
        <ul className="space-y-1.5">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]">
              <span className="text-[#888] mt-0.5 flex-shrink-0">•</span>
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ChannelVideoDetailModalProps {
  video: ChannelVideo | null;
  isOpen: boolean;
  onClose: () => void;
  channelStats?: ChannelStats | null;
}

export function ChannelVideoDetailModal({
  video,
  isOpen,
  onClose,
  channelStats,
}: ChannelVideoDetailModalProps) {
  const {
    isBoosting,
    seoPackage,
    activeBoostTab,
    videoAnalysis,
    isAnalyzing,
    activeAnalysisTab,
    setActiveBoostTab,
    setActiveAnalysisTab,
    fetchAnalysis,
    handleBoost,
  } = useVideoBoost({ video, isOpen, channelStats });

  if (!video) return null;

  const analysisTabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "title" as const, label: "Title" },
    { id: "thumbnail" as const, label: "Thumbnail" },
    { id: "hook" as const, label: "Hook" },
    { id: "retention" as const, label: "Retention" },
    { id: "seo" as const, label: "SEO" },
    { id: "actions" as const, label: "Actions" },
  ];

  function renderAnalysisContent() {
    if (!videoAnalysis) return null;

    const { summary, strengths, weaknesses, opportunities, title_analysis, thumbnail_analysis, hook_analysis, retention_analysis, seo_analysis, overall_score, overall_grade, action_items } = videoAnalysis;

    switch (activeAnalysisTab) {
      case "overview":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <ScoreBadge score={overall_score} grade={overall_grade} />
              <p className="text-sm text-[#ccc] italic">{summary}</p>
            </div>
            {strengths.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-2">Strengths</h6>
                <ul className="space-y-1.5">
                  {strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]"><span className="text-green-400 mt-0.5 flex-shrink-0">✓</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {weaknesses.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Weaknesses</h6>
                <ul className="space-y-1.5">
                  {weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]"><span className="text-red-400 mt-0.5 flex-shrink-0">✗</span><span>{w}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {opportunities.length > 0 && (
              <div>
                <h6 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">Opportunities</h6>
                <ul className="space-y-1.5">
                  {opportunities.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]"><span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span><span>{o}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      case "title":
        return <AnalysisSection score={title_analysis.score} feedback={title_analysis.feedback} suggestions={title_analysis.suggestions} />;
      case "thumbnail":
        return <AnalysisSection score={thumbnail_analysis.score} feedback={thumbnail_analysis.feedback} suggestions={thumbnail_analysis.suggestions} />;
      case "hook":
        return <AnalysisSection score={hook_analysis.score} feedback={hook_analysis.feedback} suggestions={hook_analysis.suggestions} />;
      case "retention":
        return <AnalysisSection score={retention_analysis.score} feedback={retention_analysis.feedback} suggestions={retention_analysis.suggestions} />;
      case "seo":
        return <AnalysisSection score={seo_analysis.score} feedback={seo_analysis.feedback} suggestions={seo_analysis.suggestions} />;
      case "actions":
        return (
          <div className="space-y-3">
            <h6 className="text-xs font-semibold text-white uppercase tracking-wider mb-2">Priority Action Items</h6>
            <ul className="space-y-2">
              {action_items.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[#ccc]"><span className="text-[#888] mt-0.5 flex-shrink-0 font-bold">{i + 1}.</span><span>{a}</span></li>
              ))}
            </ul>
          </div>
        );
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-3xl w-full h-[1050px] max-h-[1050px] overflow-y-auto scrollbar-hide bg-[#0f0f0f] border-[#2a2a2a] rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">{video.title}</DialogTitle>
          <DialogDescription className="text-[#888]">{video.channelTitle} • {formatDateLongRelative(video.publishedAt)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="relative w-full h-52">
            <Image src={video.thumbnail} alt={video.title} width={640} height={360} className="object-cover rounded-lg w-full h-52" unoptimized />
            <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-2 py-1 rounded font-medium">{video.duration}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-lg font-bold text-white">{formatCompactNumber(video.viewCount)}</p><p className="text-xs text-[#888]">Views</p></div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-lg font-bold text-white">{video.performanceScore}%</p><p className="text-xs text-[#888]">Performance</p></div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-lg font-bold text-white">{video.outlierScore}x</p><p className="text-xs text-[#888]">Outlier</p></div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-lg font-bold text-emerald-400">+{video.improvementPotential}%</p><p className="text-xs text-[#888]">Potential</p></div>
          </div>
          {channelStats && (
            <div className="p-4 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
              <h4 className="text-sm font-semibold text-white mb-2">Channel Context</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="text-center"><p className="font-bold text-white">{formatCompactNumber(channelStats.avgViews)}</p><p className="text-xs text-[#888]">Avg Views</p></div>
                <div className="text-center"><p className="font-bold text-white">{channelStats.avgPerformance}%</p><p className="text-xs text-[#888]">Avg Performance</p></div>
                <div className="text-center"><p className="font-bold text-white">{channelStats.healthScore}</p><p className="text-xs text-[#888]">Health Score</p></div>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between border-b border-[#2a2a2a] pb-2"><span className="text-[#888]">Views/Day</span><span className="font-medium text-white">{video.viewsPerDay > 0 ? formatCompactNumber(video.viewsPerDay) : "Just published"}</span></div>
            <div className="flex justify-between border-b border-[#2a2a2a] pb-2"><span className="text-[#888]">Duration</span><span className="font-medium text-white">{video.duration}</span></div>
            <div className="flex justify-between border-b border-[#2a2a2a] pb-2"><span className="text-[#888]">Hook Type</span><span className="font-medium text-white">{video.hookType}</span></div>
            <div className="flex justify-between border-b border-[#2a2a2a] pb-2"><span className="text-[#888]">Tags</span><span className="font-medium text-white">{video.tags.length}</span></div>
          </div>

          <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
              <div>
                <h5 className="font-semibold text-sm text-white">AI Video Analysis</h5>
                <p className="text-xs text-[#888]">Deep performance analysis powered by LLM</p>
              </div>
              <div className="flex items-center gap-2">
                {videoAnalysis && <ScoreBadge score={videoAnalysis.overall_score} grade={videoAnalysis.overall_grade} />}
                <Button size="sm" variant="outline" onClick={() => fetchAnalysis(true)} disabled={isAnalyzing} className="border-[#2a2a2a] bg-transparent text-[#ccc] hover:text-black hover:bg-white hover:border-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {isAnalyzing ? (
                    <><svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Analyzing...</>
                  ) : (
                    <><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Refresh</>
                  )}
                </Button>
              </div>
            </div>
            {isAnalyzing && !videoAnalysis ? (
              <div className="p-6 text-center">
                <div className="animate-spin h-6 w-6 border-b-2 border-white rounded-full mx-auto mb-3" />
                <p className="text-sm text-[#888]">Analyzing video performance...</p>
                <p className="text-xs text-[#666] mt-1">This may take 30-60 seconds</p>
              </div>
            ) : videoAnalysis ? (
              <div className="p-4 space-y-4">
                <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1 overflow-x-auto">
                  {analysisTabs.map((tab) => (
                    <button key={tab.id} onClick={() => setActiveAnalysisTab(tab.id)} className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${activeAnalysisTab === tab.id ? "bg-[#2a2a2a] text-white shadow-sm" : "text-[#888] hover:text-white"}`}>{tab.label}</button>
                  ))}
                </div>
                {renderAnalysisContent()}
              </div>
            ) : (
              <div className="p-6 text-center">
                <p className="text-sm text-white mb-1">No analysis yet</p>
                <p className="text-xs text-[#888]">Click Refresh to generate an AI performance analysis for this video.</p>
              </div>
            )}
          </div>

          <div className="border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
              <div>
                <h5 className="font-semibold text-sm text-white">Boost with AI Metadata</h5>
                <p className="text-xs text-[#888]">Generate enhanced title, description, tags, and thumbnails based on what performs best in this niche.</p>
              </div>
              <Button size="sm" onClick={() => void handleBoost()} disabled={isBoosting} className="bg-white text-black hover:bg-[#ccc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {isBoosting ? (
                  <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Boosting...</>
                ) : "Boost"}
              </Button>
            </div>
            {seoPackage && (
              <div className="p-4 space-y-4">
                <div className="flex gap-1 bg-[#1a1a1a] rounded-lg p-1">
                  {[{ id: "titles", label: "Titles" }, { id: "description", label: "Description" }, { id: "tags", label: "Tags" }, { id: "thumbnails", label: "Thumbnails" }].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveBoostTab(tab.id as typeof activeBoostTab)} className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeBoostTab === tab.id ? "bg-[#2a2a2a] text-white shadow-sm" : "text-[#888] hover:text-white"}`}>{tab.label}</button>
                  ))}
                </div>
                {activeBoostTab === "titles" && (
                  <div className="space-y-3">
                    {seoPackage.titles.map((title, index) => (
                      <div key={index} className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-[#888]">#{title.rank}</span>
                            <span className="text-xs text-[#666]">{title.char_count} chars</span>
                            <ScoreBadge score={title.seo_score} grade={title.seo_grade} />
                          </div>
                          <CopyButton text={title.text} label="Copy title" />
                        </div>
                        <p className="text-sm font-medium text-white">{title.text}</p>
                        {title.ctr_rationale && <p className="text-xs text-[#888] mt-1">{title.ctr_rationale}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {activeBoostTab === "description" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <ScoreBadge score={seoPackage.description.seo_score} grade={seoPackage.description.seo_grade} />
                      <CopyButton text={seoPackage.description.full_text} label="Copy description" />
                    </div>
                    <div className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                      <p className="text-sm text-[#ccc] whitespace-pre-line">{seoPackage.description.full_text}</p>
                    </div>
                  </div>
                )}
                {activeBoostTab === "tags" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#666]">{seoPackage.tags.length} tags</span>
                      <CopyButton text={seoPackage.tags.map(t => t.tag).join(", ")} label="Copy all tags" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {seoPackage.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className={`text-xs flex items-center gap-1.5 ${tag.tier === "broad" ? "border-[#3a3a3a] text-[#ccc]" : tag.tier === "medium" ? "border-[#3a3a3a] text-white" : "border-emerald-500/30 text-emerald-400"}`}>
                          {tag.tag}
                          <span className={`inline-flex items-center px-1 py-0 rounded text-[10px] font-semibold border ${getScoreColorClass(tag.seo_score)}`}>{tag.seo_grade}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {activeBoostTab === "thumbnails" && (
                  <div className="space-y-3">
                    {seoPackage.thumbnail_concepts.map((concept, index) => (
                      <div key={index} className="p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-white">Concept {concept.concept_number}: {concept.text_overlay}</p>
                          <div className="flex items-center gap-2">
                            <ScoreBadge score={concept.seo_score} grade={concept.seo_grade} />
                            <CopyButton text={`Concept ${concept.concept_number}:\nText: ${concept.text_overlay}\nVisual: ${concept.visual_composition}\nColors: ${concept.colour_recommendation}\nEmotion: ${concept.emotional_trigger}`} label="Copy" />
                          </div>
                        </div>
                        <div className="text-xs text-[#ccc] space-y-1">
                          <p><span className="font-medium text-white">Visual:</span> {concept.visual_composition}</p>
                          <p><span className="font-medium text-white">Colors:</span> {concept.colour_recommendation}</p>
                          <p><span className="font-medium text-white">Emotion:</span> {concept.emotional_trigger}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
