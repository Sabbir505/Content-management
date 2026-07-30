"use client";

import { toast } from "sonner";
import { VideoWithOutlier } from "@/types/video";
import { ContentItem } from "@/types/content";
import {
  saveVideoToBoard,
  saveContentToBoard,
  saveVideoToLocalIdeas,
  saveContentToLocalIdeas,
} from "@/lib/discovery/save-to-board";

const MY_IDEAS_BOARD_ID = "my-ideas";

export function useBoardSave(userId: string | undefined) {
  async function saveVideo(video: VideoWithOutlier): Promise<void> {
    if (!userId) {
      saveVideoToLocalIdeas(video);
      toast.success("Added to My Ideas", { description: video.title });
      return;
    }
    try {
      await saveVideoToBoard(userId, MY_IDEAS_BOARD_ID, video);
      toast.success("Added to My Ideas", { description: video.title });
    } catch {
      // Firestore unreachable (blocked/offline) — keep the idea locally so it
      // still shows up in My Ideas instead of being lost.
      saveVideoToLocalIdeas(video);
      toast.success("Added to My Ideas", { description: video.title });
    }
  }

  async function saveContent(item: ContentItem): Promise<void> {
    if (!userId) {
      saveContentToLocalIdeas(item);
      toast.success("Added to My Ideas", { description: item.title });
      return;
    }
    try {
      await saveContentToBoard(userId, MY_IDEAS_BOARD_ID, item);
      toast.success("Added to My Ideas", { description: item.title });
    } catch {
      saveContentToLocalIdeas(item);
      toast.success("Added to My Ideas", { description: item.title });
    }
  }

  return { saveVideo, saveContent };
}
