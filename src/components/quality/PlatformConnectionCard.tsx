"use client";

import type { PlatformConnection } from "@/lib/quality/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlatformConnectionCardProps {
  connection: PlatformConnection;
  onConnect: () => void;
  onDisconnect: () => void;
}

const platformLabels: Record<string, string> = {
  youtube: "YouTube Analytics",
  x: "X / Twitter",
  instagram: "Instagram",
  facebook: "Facebook",
};

const platformIcons: Record<string, string> = {
  youtube: "▶",
  x: "𝕏",
  instagram: "📷",
  facebook: "f",
};

export function PlatformConnectionCard({
  connection,
  onConnect,
  onDisconnect,
}: PlatformConnectionCardProps) {
  return (
    <div className="flex items-center justify-between border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-4 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-lg text-[#ccc]">{platformIcons[connection.platform]}</span>
        <div>
          <p className="font-medium text-sm text-white">
            {platformLabels[connection.platform]}
          </p>
          {connection.connected && connection.platformUsername && (
            <p className="text-xs text-[#666]">
              Connected as @{connection.platformUsername}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-xs font-medium px-2 py-1 rounded",
            connection.connected
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-[#2a2a2a] text-[#888]"
          )}
        >
          {connection.connected ? "Connected" : "Not connected"}
        </span>

        {connection.connected ? (
          <Button
            size="sm"
            variant="outline"
            onClick={onDisconnect}
            className="bg-[#0a0a0a] border-[#3a3a3a] text-white hover:bg-[#2a2a2a] hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
          >
            Disconnect
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            className="bg-emerald-400 text-[#0a0a0a] hover:bg-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] transition-colors"
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
