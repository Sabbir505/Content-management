"use client";

import type { PerformanceInsights } from "@/lib/quality/types";
import { CorrelationInsight } from "./CorrelationInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PerformanceDashboardProps {
  insights: PerformanceInsights;
  isLoading: boolean;
}

const platformLabels: Record<string, string> = {
  youtube: "YouTube Videos",
  x: "X / Twitter Posts",
  instagram: "Instagram Posts",
  facebook: "Facebook Posts",
};

export function PerformanceDashboard({
  insights,
  isLoading,
}: PerformanceDashboardProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse" />
          <div className="h-24 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse" />
        </div>
        <div className="h-48 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] animate-pulse" />
      </div>
    );
  }

  const hasData =
    insights.totalGenerated > 0 ||
    insights.totalTracked > 0 ||
    insights.platformBreakdown.some((p) => p.count > 0);

  if (!hasData) {
    return (
      <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
        <CardContent className="p-8 text-center">
          <p className="text-[#ccc] mb-1">No performance data yet</p>
          <p className="text-sm text-[#666]">
            Generate content and connect your platforms to see how it performs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{insights.totalGenerated}</p>
            <p className="text-sm text-[#888]">Content generated</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-white">{insights.totalTracked}</p>
            <p className="text-sm text-[#888]">With performance data</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {insights.platformBreakdown
          .filter((p) => p.count > 0)
          .map((platform) => (
            <Card key={platform.platform} className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-white">
                  {platformLabels[platform.platform] || platform.platform}{" "}
                  <Badge
                    variant="secondary"
                    className="bg-[#2a2a2a] text-[#ccc] border border-transparent"
                  >
                    {platform.count} tracked
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(platform.avgMetrics).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(platform.avgMetrics).map(
                      ([metric, value]) => (
                        <div key={metric}>
                          <p className="text-xs text-[#666] capitalize">
                            {metric.replace(/([A-Z])/g, " $1")}
                          </p>
                          <p className="font-medium text-sm text-white">
                            {typeof value === "number"
                              ? value < 1
                                ? `${(value * 100).toFixed(1)}%`
                                : value.toLocaleString()
                              : String(value)}
                          </p>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#666]">
                    Connect your {platformLabels[platform.platform]} account to
                    see performance data
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {(insights.workingInsights.length > 0 ||
        insights.notWorkingInsights.length > 0) && (
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardContent className="p-5 space-y-4">
            <CorrelationInsight
              insights={insights.workingInsights}
              type="working"
            />
            <CorrelationInsight
              insights={insights.notWorkingInsights}
              type="notWorking"
            />
          </CardContent>
        </Card>
      )}

      {insights.lastCalibratedAt && (
        <p className="text-xs text-[#666] text-center">
          Last calibration:{" "}
          {new Date(insights.lastCalibratedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
