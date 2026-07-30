"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FeedbackFormProps {
  onSubmit: (feedback: { rating: number; tags: string[] }) => void;
}

const FEEDBACK_TAGS = [
  "Too formal",
  "Too casual",
  "Wrong hooks",
  "Not my tone",
  "Just right",
];

export function FeedbackForm({ onSubmit }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit() {
    if (rating === 0 || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ rating, tags: selectedTags });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[#ccc]">Did this sound like you?</p>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className={`text-2xl transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] rounded ${
              star <= rating ? "text-emerald-400" : "text-[#3a3a3a] hover:text-[#666]"
            }`}
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FEEDBACK_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] ${
              selectedTags.includes(tag)
                ? "bg-[#3a3a3a] text-white border border-[#3a3a3a]"
                : "bg-[#0a0a0a] text-[#ccc] border border-[#2a2a2a] hover:bg-[#2a2a2a] hover:text-[#ccc] hover:border-[#3a3a3a]"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={rating === 0 || isSubmitting}
        className="w-full bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0a0a0a]" />
            Submitting...
          </span>
        ) : (
          "Submit Feedback"
        )}
      </Button>
    </div>
  );
}
