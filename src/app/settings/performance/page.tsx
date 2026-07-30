"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceDashboard } from "@/components/quality/PerformanceDashboard";
import { PlatformConnectionCard } from "@/components/quality/PlatformConnectionCard";
import { toast } from "sonner";
import type { PerformanceInsights, PlatformConnection } from "@/lib/quality/types";
import { PLATFORM_TYPES } from "@/lib/quality/types";

export default function PerformanceInsightsPage() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PerformanceInsights | null>(null);
  const [connections, setConnections] = useState<PlatformConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalibrating, setIsCalibrating] = useState(false);

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

        const connectionPromises = PLATFORM_TYPES.map(async (platform) => {
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
    toast.error(`${platform} OAuth is not configured. Add credentials to enable.`);
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
    } catch {
      toast.error(`Failed to disconnect ${platform}`);
    }
  }

  async function handleCalibrate() {
    if (!user || isCalibrating) return;
    setIsCalibrating(true);
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
    } catch {
      toast.error("Calibration failed");
    } finally {
      setIsCalibrating(false);
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
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-white">Performance Insights</h1>
          <p className="text-[#888]">
            See how your Outlierly-generated content performs across platforms
          </p>
        </div>

        <div className="grid gap-6">
          <PerformanceDashboard
            insights={insights || defaultInsights}
            isLoading={isLoading}
          />

          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Analytics Connections</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {PLATFORM_TYPES.map((platform) => (
                    <div
                      key={platform}
                      className="h-16 rounded-lg bg-[#2a2a2a] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                PLATFORM_TYPES.map((platform) => {
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
                })
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardHeader>
              <CardTitle className="text-white">Score Calibration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#888]">
                Every 14 days, Outlierly adjusts scoring weights based on your
                content&apos;s real performance. This makes scores more accurate
                for your specific content style over time.
              </p>
              <Button
                onClick={handleCalibrate}
                disabled={isCalibrating}
                variant="outline"
                className="bg-[#0a0a0a] border-[#3a3a3a] text-white hover:bg-[#2a2a2a] hover:border-[#3a3a3a] focus-visible:ring-2 focus-visible:ring-[#3a3a3a] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCalibrating ? "Calibrating..." : "Run Calibration Now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
