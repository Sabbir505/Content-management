"use client";

import { Button } from "@/components/ui/button";
import type { VoiceProfileVersion } from "@/lib/voice-analysis";

interface VersionHistoryProps {
  versions: VoiceProfileVersion[];
  onRevert: (version: VoiceProfileVersion) => void;
}

export function VersionHistory({ versions, onRevert }: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <p className="text-sm text-[#666]">No versions to show.</p>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between p-3 border rounded-lg bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors"
        >
          <div>
            <p className="text-sm font-medium text-white">Version {v.version}</p>
            <p className="text-xs text-[#888]">
              {new Date(v.createdAt).toLocaleDateString()} · {v.sources.join(", ")}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRevert(v)}
            className="bg-[#0a0a0a] border-[#2a2a2a] text-[#ccc] hover:bg-[#2a2a2a] hover:text-white hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
          >
            Revert
          </Button>
        </div>
      ))}
    </div>
  );
}
