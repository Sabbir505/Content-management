"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCompactNumber, formatDateLongRelative } from "@/lib/format";
import type { ChannelVideo } from "@/lib/channel-analytics";

interface ChannelVideoCardProps {
  video: ChannelVideo;
  onClick: () => void;
  isCompareMode?: boolean;
  isInCompareSelection?: boolean;
  onToggleCompare?: (id: string) => void;
}

export function ChannelVideoCard({
  video,
  onClick,
  isCompareMode,
  isInCompareSelection,
  onToggleCompare,
}: ChannelVideoCardProps) {
  return (
    <Card className="cursor-pointer hover:border-[#3a3a3a] transition-colors bg-[#1a1a1a] border-[#2a2a2a] text-white" onClick={onClick}>
      <CardContent className="p-3">
        <div className="relative mb-3 w-full h-40">
          <Image src={video.thumbnail} alt={video.title} width={352} height={198} className="object-cover rounded-lg w-full h-40" unoptimized />
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded font-medium">{video.duration}</span>
          {video.isShort && <Badge variant="secondary" className="absolute top-2 left-2 text-xs bg-[#1a1a1a] text-white border-[#2a2a2a]">Short</Badge>}
          {isCompareMode && (
            <div className="absolute top-2 right-2" onClick={(e) => { e.stopPropagation(); onToggleCompare?.(video.id); }}>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${isInCompareSelection ? "bg-emerald-400 border-emerald-400" : "bg-[#1a1a1a]/90 border-[#2a2a2a] hover:border-[#3a3a3a]"}`}>
                {isInCompareSelection && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
            </div>
          )}
        </div>
        <h4 className="font-semibold text-sm line-clamp-2 leading-snug text-white mb-2">{video.title}</h4>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#888] mb-2">
          <span>{formatCompactNumber(video.viewCount)} views</span>
          <span>{formatDateLongRelative(video.publishedAt)}</span>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs text-[#888] mb-1"><span>Performance</span><span>{video.performanceScore}%</span></div>
          <Progress value={video.performanceScore} className="h-1.5 bg-[#2a2a2a] [&>div>div]:bg-white" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {video.outlierScore > 1.5 && <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30 bg-emerald-500/10">{video.outlierScore}x outlier</Badge>}
          {video.outlierScore < 0.5 && video.outlierScore > 0 && <Badge variant="outline" className="text-xs text-red-400 border-red-500/30 bg-red-500/10">{video.outlierScore}x below avg</Badge>}
          <Badge variant="outline" className="text-xs text-[#888] border-[#2a2a2a]">{video.hookType}</Badge>
          {video.improvementPotential > 40 && <Badge variant="destructive" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">+{video.improvementPotential}%</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

interface ChannelVideoTableProps {
  videos: ChannelVideo[];
  selectedVideo: ChannelVideo | null;
  setSelectedVideo: (video: ChannelVideo | null) => void;
  onFixVideo?: (video: ChannelVideo) => void;
  isCompareMode?: boolean;
  compareSelection?: Set<string>;
  onToggleCompare?: (id: string) => void;
}

export function ChannelVideoTable({
  videos,
  setSelectedVideo,
  isCompareMode,
  compareSelection,
  onToggleCompare,
}: ChannelVideoTableProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      {videos.map((video) => (
        <ChannelVideoCard key={video.id} video={video} onClick={() => setSelectedVideo(video)}
          isCompareMode={isCompareMode} isInCompareSelection={compareSelection?.has(video.id)} onToggleCompare={onToggleCompare} />
      ))}
      {videos.length === 0 && (
        <div className="text-center py-12 col-span-full">
          <p className="text-sm text-white mb-1">No videos found</p>
          <p className="text-xs text-[#888]">Try adjusting your filters or search query.</p>
        </div>
      )}
    </div>
  );
}
