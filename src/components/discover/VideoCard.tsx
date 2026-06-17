"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VideoWithOutlier } from "@/types/video";
import { useRouter } from "next/navigation";
import React from "react";

import Image from "next/image";

interface VideoCardProps {
  video: VideoWithOutlier;
  onSave?: (video: VideoWithOutlier) => void;
}

export const VideoCard = React.memo(function VideoCard({ video, onSave }: VideoCardProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);

  function formatViews(viewCount: number): string {
    if (viewCount >= 1000000) {
      return `${(viewCount / 1000000).toFixed(1)}M`;
    }
    if (viewCount >= 1000) {
      return `${(viewCount / 1000).toFixed(1)}K`;
    }
    return viewCount.toString();
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function getOutlierColor(score: number): string {
    if (score >= 10) return "bg-red-500";
    if (score >= 5) return "bg-orange-500";
    if (score >= 2) return "bg-yellow-500";
    return "bg-gray-500";
  }

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="relative h-48 w-full">
          <Image
            src={video.thumbnail}
            alt={video.title || "Video thumbnail"}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            className="object-cover cursor-pointer"
            onClick={() => setIsModalOpen(true)}
            unoptimized
          />
          <Badge className="absolute top-2 right-2 bg-black/70 text-white">
            {formatViews(video.viewCount)} views
          </Badge>
          {video.outlierScore > 0 && (
            <Badge className={`absolute top-2 left-2 ${getOutlierColor(video.outlierScore)} text-white`}>
              {video.outlierScore}x outlier
            </Badge>
          )}
          {video.discoveryScore !== undefined && video.discoveryScore > 0 && (
            <Badge className="absolute bottom-2 right-2 bg-blue-600/90 text-white text-xs">
              {video.discoveryScore.toFixed(0)} discovery
            </Badge>
          )}
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold mb-2 line-clamp-2">{video.title}</h3>
          <p className="text-sm text-gray-600 mb-1">{video.channelTitle}</p>
          <p className="text-xs text-gray-500 mb-3">{formatDate(video.publishedAt)}</p>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className="text-xs">
              {video.hookType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {video.estimatedStructure}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Video Detail Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="w-[868px] max-w-[95vw] max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle className="text-xl">{video.title}</DialogTitle>
            <DialogDescription>
              {video.channelTitle} · {formatDate(video.publishedAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Thumbnail */}
            <div className="relative h-64 w-full">
              <Image
                src={video.thumbnail}
                alt={video.title || "Video thumbnail"}
                fill
                sizes="(max-width: 768px) 100vw, 800px"
                className="object-cover rounded-lg"
                unoptimized
              />
              {video.outlierScore > 0 && (
                <Badge className={`absolute top-2 left-2 ${getOutlierColor(video.outlierScore)} text-white`}>
                  {video.outlierScore}x outlier
                </Badge>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{formatViews(video.viewCount)}</p>
                <p className="text-xs text-gray-600">Views</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{formatViews(video.likeCount)}</p>
                <p className="text-xs text-gray-600">Likes</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{formatViews(video.commentCount)}</p>
                <p className="text-xs text-gray-600">Comments</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold">{video.duration}</p>
                <p className="text-xs text-gray-600">Duration</p>
              </div>
            </div>

            {/* Analysis */}
            <div className="space-y-3">
              <h4 className="font-semibold">Analysis</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Hook: {video.hookType}</Badge>
                <Badge variant="outline">Structure: {video.estimatedStructure}</Badge>
                <Badge variant="outline">Channel Avg: {formatViews(video.channelAvgViews)}</Badge>
              </div>
            </div>

            {/* Description */}
            {video.description && (
              <div className="space-y-2">
                <h4 className="font-semibold">Description</h4>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{video.description}</p>
              </div>
            )}

            {/* Tags */}
            {video.tags && video.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {video.tags.slice(0, 10).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                className="flex-1"
                onClick={() => {
                  setIsModalOpen(false);
                  router.push(`/create/script?videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}`);
                }}
              >
                Generate Script
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  router.push(`/create/social?videoId=${video.id}&title=${encodeURIComponent(video.title)}&description=${encodeURIComponent(video.description || "")}`);
                }}
              >
                Social Posts
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false);
                  router.push(`/analyze?videoId=${video.id}`);
                }}
              >
                Analyze Structure
              </Button>
              {onSave && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    onSave(video);
                    setIsModalOpen(false);
                  }}
                >
                  Save to Board
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
