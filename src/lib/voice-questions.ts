export interface VoiceQuestion {
  key: string;
  question: string;
  options: string[];
}

export const VOICE_QUESTIONS: VoiceQuestion[] = [
  {
    key: "hookStyle",
    question: "How do you usually start your videos?",
    options: [
      "Direct question to the viewer",
      "Bold statement or hot take",
      "Story or personal anecdote",
      "Shocking fact or statistic",
      "Teaser of what's coming",
    ],
  },
  {
    key: "sentenceLength",
    question: "How would you describe your speaking style?",
    options: [
      "Short, punchy sentences",
      "Medium length, conversational",
      "Long, flowing paragraphs",
      "Mixed - I vary my rhythm",
    ],
  },
  {
    key: "tone",
    question: "What is your default tone?",
    options: [
      "Energetic and enthusiastic",
      "Calm and authoritative",
      "Casual and friendly",
      "Sarcastic and witty",
      "Inspirational and motivational",
    ],
  },
  {
    key: "vocabulary",
    question: "How would you describe your word choice?",
    options: [
      "Simple and accessible",
      "Technical and precise",
      "Creative and descriptive",
      "Industry jargon heavy",
      "Trendy and meme-aware",
    ],
  },
  {
    key: "humorLevel",
    question: "How much humor do you use?",
    options: [
      "None - strictly serious",
      "Occasional dry wit",
      "Frequent jokes and quips",
      "Constant comedy energy",
    ],
  },
  {
    key: "ctaPattern",
    question: "How do you ask viewers to take action?",
    options: [
      "Direct command (Subscribe now!)",
      "Soft suggestion (Consider subscribing)",
      "Value-driven (Join the community)",
      "Question-based (What do you think?)",
      "Minimal - I rarely ask",
    ],
  },
];
