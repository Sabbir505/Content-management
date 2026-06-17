"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceDashboard } from "@/components/quality/PerformanceDashboard";
import { PlatformConnectionCard } from "@/components/quality/PlatformConnectionCard";
import { toast } from "sonner";
import type { PerformanceInsights, PlatformConnection } from "@/lib/quality/types";

const PLATFORMS = ["youtube", "x", "instagram", "facebook"] as const;

export default function PerformanceInsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    async function fetchData() {
      setIsLoading(true);
      try {
        const [insightsRes] = await Promise.all([
          fetch(`/api/quality/feedback/insights?userId=${uid}`),
        ]);

        if (insightsRes.ok) {
          const result = await insightsRes.json();
          if (result.success) setInsights(result.data);
        }

        // Fetch platform connections
        const connectionPromises = PLATFORMS.map(async (platform) => {
          try {
            const res = await fetch(`/api/quality/connections/${platform}?userId=${uid}`);
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.data) {
                return data.data as PlatformConnection;
              }
            }
          } catch {
            // Platform connection fetch failed, use default disconnected state
          }
          return {
            platform,
            connected: false,
            connectedAt: null,
            tokenExpiry: null,
            platformUserId: null,
            platformUsername: null,
          } as PlatformConnection;
        });

        const connectionResults = await Promise.all(connectionPromises);
        setConnections(connectionResults);
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [user]);

  async function handleConnect(platform: string) {
    toast.info(`Connecting ${platform}... (OAuth flow not yet implemented)`);
  }

  async function handleDisconnect(platform: string) {
    if (!user) return;
    try {
      const response = await fetch(`/api/quality/connections/${platform}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (response.ok) {
        toast.success(`${platform} disconnected`);
        setConnections((prev) =>
          prev.map((c) =>
            c.platform === platform
              ? { ...c, connected: false, connectedAt: null, platformUsername: null }
              : c
          )
        );
      }
    } catch (error) {
      toast.error(`Failed to disconnect ${platform}`);
    }
  }

  async function handleCalibrate() {
    if (!user) return;
    try {
      const response = await fetch("/api/quality/feedback/calibrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      const result = await response.json();
      if (result.success && result.data.calibrated) {
        toast.success("Scoring weights recalibrated based on your performance data");
      } else {
        toast.info(result.data?.reason || "Not enough data for calibration yet");
      }
    } catch (error) {
      toast.error("Calibration failed");
    }
  }

  const defaultInsights: PerformanceInsights = {
    totalGenerated: 0,
    totalTracked: 0,
    platformBreakdown: [],
    workingInsights: [],
    notWorkingInsights: [],
    lastCalibratedAt: null,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Performance Insights</h1>
          <p className="text-gray-600">
            See how your TubeForge-generated content performs across platforms
          </p>
        </div>

        <div className="grid gap-6">
          {/* Performance Dashboard */}
          <PerformanceDashboard
            insights={insights || defaultInsights}
            isLoading={isLoading}
          />

          {/* Platform Connections */}
          <Card>
            <CardHeader>
              <CardTitle>Analytics Connections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {PLATFORMS.map((platform) => {
                const connection = connections.find(
                  (c) => c.platform === platform
                ) || {
                  platform,
                  connected: false,
                  connectedAt: null,
                  tokenExpiry: null,
                  platformUserId: null,
                  platformUsername: null,
                };

                return (
                  <PlatformConnectionCard
                    key={platform}
                    connection={connection}
                    onConnect={() => handleConnect(platform)}
                    onDisconnect={() => handleDisconnect(platform)}
                  />
                );
              })}
            </CardContent>
          </Card>

          {/* Calibration */}
          <Card>
            <CardHeader>
              <CardTitle>Score Calibration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-600">
                Every 14 days, TubeForge adjusts scoring weights based on your
                content&apos;s real performance. This makes scores more accurate
                for your specific content style over time.
              </p>
              <Button onClick={handleCalibrate} variant="outline">
                Run Calibration Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
