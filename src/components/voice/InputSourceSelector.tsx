"use client";

import { Film, Link2, FileText, Type, MessagesSquare } from "lucide-react";
import { SourceCard } from "./SourceCard";

interface InputSourceSelectorProps {
  onSelect: (method: string) => void;
}

export function InputSourceSelector({ onSelect }: InputSourceSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SourceCard
        title="YouTube Channel Import"
        description="Analyze your existing videos to extract your voice"
        icon={Film}
        onClick={() => onSelect("youtube")}
      />
      <SourceCard
        title="Paste Video Links"
        description="Paste YouTube video URLs to analyze transcripts"
        icon={Link2}
        onClick={() => onSelect("links")}
      />
      <SourceCard
        title="File Upload"
        description="Upload .txt, .docx, or .csv files with your content"
        icon={FileText}
        onClick={() => onSelect("file")}
      />
      <SourceCard
        title="Paste Sample Text"
        description="Paste your own script or transcript text to analyze"
        icon={Type}
        onClick={() => onSelect("sample")}
      />
      <SourceCard
        title="Guided Chat"
        description="Answer questions to define your style"
        icon={MessagesSquare}
        onClick={() => onSelect("chat")}
      />
    </div>
  );
}
