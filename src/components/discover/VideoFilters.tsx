"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingFilter } from "@/types/video";

const NICHES = [
  "All",
  "Finance",
  "Tech",
  "Lifestyle",
  "Education",
  "Entertainment",
  "Health",
  "Business",
  "Gaming",
];

const TIME_RANGES = [
  { value: "day", label: "Last 24 hours" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
  { value: "year", label: "Last year" },
];

const SORT_OPTIONS = [
  { value: "views", label: "Most Viewed" },
  { value: "outlier", label: "Highest Outlier" },
  { value: "recent", label: "Most Recent" },
  { value: "comments", label: "Most Commented" },
];

const LANGUAGE_OPTIONS = [
  { value: "any", label: "Any Language" },
  { value: "en", label: "English Only" },
];

interface VideoFiltersProps {
  filters: TrendingFilter;
  onFiltersChange: (filters: TrendingFilter) => void;
}

export function VideoFilters({ filters, onFiltersChange }: VideoFiltersProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Niche */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Niche:</span>
            <Select
              value={filters.niche}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, niche: value ?? "all" })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NICHES.map((niche) => (
                  <SelectItem key={niche} value={niche.toLowerCase()}>
                    {niche}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Time:</span>
            <Select
              value={filters.timeRange}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, timeRange: (value ?? "week") as TrendingFilter["timeRange"] })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Sort:</span>
            <Select
              value={filters.sortBy}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, sortBy: (value ?? "views") as TrendingFilter["sortBy"] })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Language:</span>
            <Select
              value={filters.language}
              onValueChange={(value) =>
                onFiltersChange({ ...filters, language: (value ?? "any") as TrendingFilter["language"] })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outlier Score */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Min Outlier:</span>
            <Input
              type="number"
              min={0}
              step={0.1}
              value={filters.minOutlier || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, minOutlier: val === "" ? 0 : parseFloat(val) || 0 });
              }}
              className="w-20"
            />
          </div>

          {/* Max Duration */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Max Duration (min):</span>
            <Input
              type="number"
              min={0}
              value={filters.maxDuration || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, maxDuration: val === "" ? 0 : parseInt(val) || 0 });
              }}
              className="w-20"
            />
          </div>
          {/* Min Views */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Min Views:</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={filters.minViews || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, minViews: val === "" ? 0 : parseInt(val) || 0 });
              }}
              className="w-24"
            />
          </div>

          {/* Max Views */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Max Views:</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={filters.maxViews || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, maxViews: val === "" ? 0 : parseInt(val) || 0 });
              }}
              className="w-24"
            />
          </div>

          {/* Min Subs */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Min Subs:</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={filters.minSubs || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, minSubs: val === "" ? 0 : parseInt(val) || 0 });
              }}
              className="w-24"
            />
          </div>

          {/* Max Subs */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Max Subs:</span>
            <Input
              type="number"
              min={0}
              step={1000}
              value={filters.maxSubs || ""}
              placeholder="Any"
              onChange={(e) => {
                const val = e.target.value;
                onFiltersChange({ ...filters, maxSubs: val === "" ? 0 : parseInt(val) || 0 });
              }}
              className="w-24"
            />
          </div>
        </div>

        {/* Active Filters */}
        <div className="flex flex-wrap gap-2">
          {filters.niche !== "all" && (
            <Badge variant="secondary">
              Niche: {filters.niche}
            </Badge>
          )}
          {filters.language !== "any" && (
            <Badge variant="secondary">
              Language: {filters.language === "en" ? "English" : filters.language}
            </Badge>
          )}
          {filters.minViews > 0 && (
            <Badge variant="secondary">
              Min Views: {filters.minViews.toLocaleString()}
            </Badge>
          )}
          {filters.maxViews > 0 && (
            <Badge variant="secondary">
              Max Views: {filters.maxViews.toLocaleString()}
            </Badge>
          )}
          {filters.minSubs > 0 && (
            <Badge variant="secondary">
              Min Subs: {filters.minSubs.toLocaleString()}
            </Badge>
          )}
          {filters.maxSubs > 0 && (
            <Badge variant="secondary">
              Max Subs: {filters.maxSubs.toLocaleString()}
            </Badge>
          )}
          {filters.minOutlier > 0 && (
            <Badge variant="secondary">
              Min Outlier: {filters.minOutlier}x
            </Badge>
          )}
          {filters.maxDuration > 0 && (
            <Badge variant="secondary">
              Max Duration: {filters.maxDuration}min
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onFiltersChange({
                niche: "all",
                timeRange: "week",
                minViews: 0,
                maxViews: 0,
                minOutlier: 0,
                maxDuration: 0,
                minSubs: 0,
                maxSubs: 0,
                sortBy: "views",
                language: "any",
              })
            }
          >
            Reset Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
