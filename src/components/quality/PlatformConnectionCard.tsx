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
    <div className="flex items-center justify-between border rounded-lg p-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">{platformIcons[connection.platform]}</span>
        <div>
          <p className="font-medium text-sm">
            {platformLabels[connection.platform]}
          </p>
          {connection.connected && connection.platformUsername && (
            <p className="text-xs text-gray-500">
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
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}
        >
          {connection.connected ? "Connected" : "Not connected"}
        </span>

        {connection.connected ? (
          <Button size="sm" variant="outline" onClick={onDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button size="sm" onClick={onConnect}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}
