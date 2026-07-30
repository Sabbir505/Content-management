"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCompactNumber, formatDateLongRelative } from "@/lib/format";
import type { ChannelVideo } from "@/lib/channel-analytics";

interface CompareModalProps {
  videos: ChannelVideo[];
  isOpen: boolean;
  onClose: () => void;
}

export function CompareModal({ videos, isOpen, onClose }: CompareModalProps) {
  if (videos.length < 2) return null;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-4xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0f0f0f] border-[#2a2a2a] rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Compare Videos</DialogTitle>
          <DialogDescription className="text-[#888]">Side-by-side comparison of 2 videos</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {videos.slice(0, 2).map((video) => (
            <div key={video.id} className="space-y-4 border border-[#2a2a2a] rounded-xl p-5 bg-[#1a1a1a]">
              <div className="relative w-full h-48">
                <Image src={video.thumbnail} alt={video.title} width={480} height={270} className="w-full h-48 object-cover rounded-lg" unoptimized />
                <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded font-medium">{video.duration}</span>
                {video.isShort && <Badge variant="secondary" className="absolute top-2 left-2 text-xs bg-[#1a1a1a] text-white border-[#2a2a2a]">Short</Badge>}
              </div>
              <h4 className="font-semibold text-sm line-clamp-2 text-white">{video.title}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Views</span><span className="font-medium text-white">{formatCompactNumber(video.viewCount)}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Performance</span><span className="font-medium text-white">{video.performanceScore}%</span></div>
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Outlier</span><span className={`font-medium ${video.outlierScore > 1.5 ? 'text-emerald-400' : video.outlierScore < 0.5 ? 'text-red-400' : 'text-white'}`}>{video.outlierScore}x</span></div>
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Hook</span><span className="font-medium text-white">{video.hookType}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Duration</span><span className="font-medium text-white">{video.duration}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-[#2a2a2a]"><span className="text-[#888]">Tags</span><span className="font-medium text-white">{video.tags.length}</span></div>
                <div className="flex justify-between items-center py-2"><span className="text-[#888]">Published</span><span className="font-medium text-white">{formatDateLongRelative(video.publishedAt)}</span></div>
              </div>
              <div className="pt-2">
                <div className="flex justify-between text-xs text-[#888] mb-1"><span>Performance</span><span>{video.performanceScore}%</span></div>
                <Progress value={video.performanceScore} className="h-2 bg-[#2a2a2a] [&>div>div]:bg-white" />
              </div>
              {video.improvementPotential > 20 && (
                <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <span className="text-emerald-400 text-xs font-semibold">+{video.improvementPotential}%</span>
                  <span className="text-[#888] text-xs">improvement potential</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
