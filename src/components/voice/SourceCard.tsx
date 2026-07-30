"use client";

import { type LucideIcon } from "lucide-react";

interface SourceCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}

export function SourceCard({ title, description, icon: Icon, onClick }: SourceCardProps) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left p-5 border rounded-xl bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#1f1f1f] hover:border-[#3a3a3a] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    >
      <div className="flex items-start gap-4">
        <span className="w-10 h-10 shrink-0 rounded-lg bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center text-[#ccc] group-hover:text-white group-hover:border-[#3a3a3a] transition-colors">
          <Icon className="w-5 h-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-white">{title}</p>
          <p className="text-sm text-[#888] mt-0.5">{description}</p>
        </div>
      </div>
    </button>
  );
}
