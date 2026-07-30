"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatCompactNumber } from "@/lib/format";
import type { ChannelVideo } from "@/lib/channel-analytics";

interface FixVideoModalProps {
  video: ChannelVideo | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FixVideoModal({ video, isOpen, onClose }: FixVideoModalProps) {
  const router = useRouter();

  if (!video) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide bg-[#0f0f0f] border-[#2a2a2a] rounded-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Fix This Video</DialogTitle>
          <DialogDescription className="text-[#888]">{video.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="relative">
            <Image src={video.thumbnail} alt={video.title} width={600} height={338} className="w-full h-48 object-cover rounded-lg" unoptimized />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-2xl font-bold text-white">{formatCompactNumber(video.viewCount)}</p><p className="text-xs text-[#888]">Views</p></div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-2xl font-bold text-white">{video.performanceScore}%</p><p className="text-xs text-[#888]">Performance</p></div>
            <div className="text-center p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]"><p className="text-2xl font-bold text-emerald-400">+{video.improvementPotential}%</p><p className="text-xs text-[#888]">Potential</p></div>
          </div>
          <div>
            <h5 className="font-semibold text-sm text-white mb-2">Suggestions</h5>
            <ul className="space-y-2">
              {video.suggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-[#ccc]"><span className="text-[#888] mt-0.5 flex-shrink-0">•</span><span>{suggestion}</span></li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 pt-4 border-t border-[#2a2a2a]">
            <Button className="w-full bg-white text-black hover:bg-[#ccc] transition-colors" onClick={() => { onClose(); router.push(`/optimize?videoId=${video.id}`); }}>Open SEO Optimizer</Button>
            <Button variant="outline" className="w-full border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors" onClick={() => { onClose(); router.push(`/discover?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}&type=video`); }}>Generate New Script</Button>
            <Button variant="outline" className="w-full border-[#2a2a2a] text-[#888] hover:text-white hover:border-[#3a3a3a] transition-colors" onClick={() => { onClose(); router.push(`/discover?action=chat&videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}&type=video&intent=social`); }}>Create Social Posts</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
