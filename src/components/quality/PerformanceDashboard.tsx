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
        <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{insights.totalGenerated}</p>
            <p className="text-sm text-gray-600">Content generated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold">{insights.totalTracked}</p>
            <p className="text-sm text-gray-600">With performance data</p>
          </CardContent>
        </Card>
      </div>

      {/* Platform Breakdown */}
      <div className="space-y-4">
        {insights.platformBreakdown
          .filter((p) => p.count > 0)
          .map((platform) => (
            <Card key={platform.platform}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {platformLabels[platform.platform] || platform.platform}{" "}
                  <Badge variant="secondary">{platform.count} tracked</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(platform.avgMetrics).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(platform.avgMetrics).map(
                      ([metric, value]) => (
                        <div key={metric}>
                          <p className="text-xs text-gray-500 capitalize">
                            {metric.replace(/([A-Z])/g, " $1")}
                          </p>
                          <p className="font-medium text-sm">
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
                  <p className="text-sm text-gray-500">
                    Connect your {platformLabels[platform.platform]} account to
                    see performance data
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Insights */}
      {(insights.workingInsights.length > 0 ||
        insights.notWorkingInsights.length > 0) && (
        <Card>
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

      {/* Last calibrated */}
      {insights.lastCalibratedAt && (
        <p className="text-xs text-gray-500 text-center">
          Last calibration:{" "}
          {new Date(insights.lastCalibratedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
