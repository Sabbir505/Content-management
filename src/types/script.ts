export interface ScriptSection {
  id: string;
  type: "hook" | "intro" | "beat" | "outro";
  content: string;
  timestamp?: string;
}

export interface Script {
  id: string;
  userId: string;
  videoId?: string;
  title: string;
  topic: string;
  tone: "educational" | "opinion" | "storytelling" | "listicle" | "documentary";
  sections: ScriptSection[];
  totalDuration: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  userId: string;
  videoId?: string;
  scriptId?: string;
  platform: "x" | "instagram" | "facebook";
  content: string;
  hashtags: string[];
  createdAt: string;
}
