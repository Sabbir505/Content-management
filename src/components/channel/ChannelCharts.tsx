"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCompactNumber } from "@/lib/format";
import type { ChannelVideo, ChannelInsights } from "@/lib/channel-analytics";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const TOOLTIP_STYLE = {
  backgroundColor: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
};

export function InsightsCharts({ insights }: { insights: ChannelInsights }) {
  const hookData = Object.entries(insights.hookPerformance).map(([name, value]) => ({ name, value }));
  const dayData = Object.entries(insights.dayPerformance).map(([name, value]) => ({ name: name.slice(0, 3), value }));
  const lengthData = Object.entries(insights.lengthPerformance).map(([name, value]) => ({ name, value }));

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <CardHeader><CardTitle className="text-sm text-white">Hook Performance</CardTitle><p className="text-xs text-[#888]">Avg outlier score by hook type. Higher = performs better vs channel average.</p></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={hookData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#888" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="#ccc" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <CardHeader><CardTitle className="text-sm text-white">Upload Day Performance</CardTitle><p className="text-xs text-[#888]">Avg outlier score by upload day. Higher = better performance on that day.</p></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#888" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <CardHeader><CardTitle className="text-sm text-white">Duration Performance</CardTitle><p className="text-xs text-[#888]">Avg outlier score by video length. Higher = better performance for that duration.</p></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={192}>
              <BarChart data={lengthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} label={{ value: "Outlier Score", angle: -90, position: "insideLeft", style: { fontSize: 10, fill: "#888" } }} />
                <Tooltip formatter={(value) => [`${value}x avg views`, "Outlier Score"]} contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="value" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ViewsOverTimeChart({ videos }: { videos: ChannelVideo[] }) {
  const data = useMemo(() => {
    return [...videos]
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
      .map((v) => ({
        date: new Date(v.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        views: v.viewCount,
        performance: v.performanceScore,
      }));
  }, [videos]);

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
      <CardHeader><CardTitle className="text-sm text-white">Views Over Time</CardTitle><p className="text-xs text-[#888]">Total view count for each video by publish date.</p></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={256}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => formatCompactNumber(v)} />
              <Tooltip formatter={(value) => formatCompactNumber(Number(value))} contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="views" stroke="#ccc" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

const PERFORMANCE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

export function PerformanceDistributionChart({ videos }: { videos: ChannelVideo[] }) {
  const data = useMemo(() => {
    const buckets: Record<string, number> = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };
    videos.forEach((v) => {
      if (v.performanceScore <= 20) buckets["0-20"]++;
      else if (v.performanceScore <= 40) buckets["21-40"]++;
      else if (v.performanceScore <= 60) buckets["41-60"]++;
      else if (v.performanceScore <= 80) buckets["61-80"]++;
      else buckets["81-100"]++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [videos]);

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
      <CardHeader><CardTitle className="text-sm text-white">Performance Distribution</CardTitle><p className="text-xs text-[#888]">How videos are spread across performance tiers. Green = top performers.</p></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={300} minHeight={256}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" nameKey="name">
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PERFORMANCE_COLORS[index % PERFORMANCE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value} videos`, `${name} Performance`]} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
          {data.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PERFORMANCE_COLORS[index % PERFORMANCE_COLORS.length] }} />
              <span className="text-xs text-[#888]">{entry.name} ({entry.value})</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
