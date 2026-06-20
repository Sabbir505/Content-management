export type CardType = "note" | "video" | "article" | "script" | "social" | "idea";

export interface BoardCard {
  id: string;
  boardId: string;
  type: CardType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  url?: string;
  videoId?: string;
  artifactType?: "script" | "social_posts";
  platform?: "x" | "instagram" | "facebook";
  scoredOutput?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}
