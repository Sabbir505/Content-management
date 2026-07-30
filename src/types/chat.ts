export type ChatRole = "user" | "assistant" | "system";
export type AttachmentType = "video" | "article" | "text" | "board_card";

export interface ChatAttachment {
  type: AttachmentType;
  cardId?: string;
  videoId?: string;
  title?: string;
  description?: string;
  hookType?: string;
  structure?: string;
  thumbnail?: string;
  url?: string;
  content?: string;
  text?: string;
}

export interface HeadlineVariation {
  label: string;
  headline: string;
}

export interface ChatArtifact {
  type: "script" | "social_posts" | "analysis" | "headline_variations";
  content: string;
  platform?: "x" | "instagram" | "facebook";
  scoredOutput?: unknown;
  headlineVariations?: HeadlineVariation[];
  sourceTitle?: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  attachments: ChatAttachment[];
  artifact?: ChatArtifact;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  boardId?: string;
  cardId?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
