"use client";

import { RefObject } from "react";
import type { FormatFilter } from "@/hooks/useDiscoverFilters";
import { X } from "lucide-react";

export const PLATFORMS = [
  { id: "youtube", label: "YouTube" },
  { id: "hackernews", label: "HackerNews" },
  { id: "devto", label: "DEV.to" },
  { id: "substack", label: "Substack" },
];

const LANGUAGES = [
  { id: "en", label: "English" },
  { id: "es", label: "Spanish" },
  { id: "pt", label: "Portuguese" },
  { id: "fr", label: "French" },
  { id: "de", label: "German" },
  { id: "it", label: "Italian" },
  { id: "nl", label: "Dutch" },
  { id: "ja", label: "Japanese" },
  { id: "ko", label: "Korean" },
  { id: "zh", label: "Chinese" },
  { id: "hi", label: "Hindi" },
  { id: "ar", label: "Arabic" },
];

const FOLLOWER_RANGES = [
  { id: "any", label: "Any" },
  { id: "1k-20k", label: "1K – 20K" },
  { id: "20k-100k", label: "20K – 100K" },
  { id: "100k-1m", label: "100K – 1M" },
  { id: "1m-8m", label: "1M – 8M" },
  { id: "8m+", label: "8M+" },
];

const OUTLIER_RANGES = [
  { id: "any", label: "Any" },
  { id: "3x", label: "3× or more" },
  { id: "5x", label: "5× or more" },
  { id: "10x", label: "10× or more" },
  { id: "20x", label: "20× or more" },
  { id: "50x", label: "50× or more" },
];

const TIME_PERIODS = [
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "3months", label: "3 months" },
  { id: "year", label: "Year" },
  { id: "all", label: "All time" },
];

const YT_ICON = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

function PlatformIcon({ id }: { id: string }) {
  switch (id) {
    case "youtube":
      return <span className="text-red-500">{YT_ICON}</span>;
    case "hackernews":
      return (
        <svg className="w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20H5.5L12 5.5z" />
        </svg>
      );
    case "devto":
      return (
        <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case "substack":
      return (
        <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24l9.56-5.39L20.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
        </svg>
      );
    default:
      return null;
  }
}

interface FilterDropdownProps {
  filterRef: RefObject<HTMLDivElement | null>;
  selectedPlatforms: string[];
  setSelectedPlatforms: React.Dispatch<React.SetStateAction<string[]>>;
  togglePlatform: (platformId: string) => void;
  selectedFormat: FormatFilter;
  setSelectedFormat: React.Dispatch<React.SetStateAction<FormatFilter>>;
  selectedLanguage: string;
  setSelectedLanguage: React.Dispatch<React.SetStateAction<string>>;
  selectedFollowers: string;
  setSelectedFollowers: React.Dispatch<React.SetStateAction<string>>;
  followerMin: string;
  setFollowerMin: React.Dispatch<React.SetStateAction<string>>;
  followerMax: string;
  setFollowerMax: React.Dispatch<React.SetStateAction<string>>;
  selectedOutlier: string;
  setSelectedOutlier: React.Dispatch<React.SetStateAction<string>>;
  selectedTimePeriod: string;
  setSelectedTimePeriod: React.Dispatch<React.SetStateAction<string>>;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
        active
          ? "bg-[#2a2a2a] border-[#3a3a3a] text-white"
          : "bg-transparent border-[#2a2a2a] text-[#888] hover:border-[#3a3a3a] hover:text-[#ccc]"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[11px] text-[#666] uppercase tracking-wider font-semibold mb-2.5">
      {label}
    </p>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[11px] text-[#666] hover:text-[#ccc] transition-colors cursor-pointer flex items-center gap-1"
    >
      <X className="w-3 h-3" />
      Clear
    </button>
  );
}

export function FilterDropdown({
  filterRef,
  selectedPlatforms,
  setSelectedPlatforms,
  togglePlatform,
  selectedFormat,
  setSelectedFormat,
  selectedLanguage,
  setSelectedLanguage,
  selectedFollowers,
  setSelectedFollowers,
  followerMin,
  setFollowerMin,
  followerMax,
  setFollowerMax,
  selectedOutlier,
  setSelectedOutlier,
  selectedTimePeriod,
  setSelectedTimePeriod,
}: FilterDropdownProps) {
  const activeFilterCount =
    (selectedPlatforms.length > 0 && selectedPlatforms.length < PLATFORMS.length ? 1 : 0) +
    (selectedFormat !== "all" ? 1 : 0) +
    (selectedLanguage !== "en" ? 1 : 0) +
    (selectedFollowers !== "any" ? 1 : 0) +
    (selectedOutlier !== "any" ? 1 : 0) +
    (selectedTimePeriod !== "all" ? 1 : 0);

  return (
    <div
      ref={filterRef}
      className="absolute right-6 top-16 z-50 w-[255px] max-h-[400px] overflow-y-auto scrollbar-hide bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#141414] border-b border-[#2a2a2a] px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="text-sm font-semibold text-white">Filters</span>
          {activeFilterCount > 0 && (
            <span className="text-xs bg-emerald-400/20 text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={() => {
              setSelectedPlatforms(PLATFORMS.map((p) => p.id));
              setSelectedFormat("all");
              setSelectedLanguage("en");
              setSelectedFollowers("any");
              setFollowerMin("");
              setFollowerMax("");
              setSelectedOutlier("any");
              setSelectedTimePeriod("all");
            }}
            className="text-xs text-[#888] hover:text-white transition-colors cursor-pointer"
          >
            Reset all
          </button>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* PLATFORMS */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Platforms" />
            {selectedPlatforms.length < PLATFORMS.length && (
              <button
                onClick={() => setSelectedPlatforms(PLATFORMS.map((p) => p.id))}
                className="text-[11px] text-[#888] hover:text-[#ccc] transition-colors cursor-pointer"
              >
                Select all
              </button>
            )}
            {selectedPlatforms.length === PLATFORMS.length && (
              <ClearButton onClick={() => setSelectedPlatforms([])} />
            )}
          </div>
          <div className="space-y-0.5">
            {PLATFORMS.map((platform) => {
              const isSelected = selectedPlatforms.includes(platform.id);
              return (
                <button
                  key={platform.id}
                  onClick={() => togglePlatform(platform.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[#1e1e1e] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <PlatformIcon id={platform.id} />
                    <span className="text-sm text-white">{platform.label}</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                      isSelected
                        ? "bg-emerald-400 border-emerald-400"
                        : "border-[#3a3a3a]"
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-[#0a0a0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* FORMAT */}
        <section>
          <SectionHeader label="Format" />
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#888] mb-2 flex items-center gap-1.5">
                <span className="text-red-500">{YT_ICON}</span> YouTube
              </p>
              <div className="flex gap-1.5">
                {(["videos", "shorts", "all"] as const).map((fmt) => (
                  <Chip
                    key={fmt}
                    label={fmt === "all" ? "All" : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    active={selectedFormat === fmt}
                    onClick={() => setSelectedFormat(fmt as FormatFilter)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-2 flex items-center gap-1.5">
                <PlatformIcon id="substack" /> Substack
              </p>
              <div className="flex gap-1.5">
                {(["articles", "notes", "all"] as const).map((fmt) => (
                  <Chip
                    key={`sub-${fmt}`}
                    label={fmt === "all" ? "All" : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
                    active={selectedFormat === fmt}
                    onClick={() => setSelectedFormat(fmt as FormatFilter)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LANGUAGES */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Languages" />
            {selectedLanguage !== "en" && (
              <ClearButton onClick={() => setSelectedLanguage("en")} />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGES.map((lang) => (
              <Chip
                key={lang.id}
                label={lang.label}
                active={selectedLanguage === lang.id}
                onClick={() => setSelectedLanguage(lang.id)}
              />
            ))}
          </div>
        </section>

        {/* FOLLOWERS */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Followers" />
            {selectedFollowers !== "any" && (
              <ClearButton onClick={() => {
                setSelectedFollowers("any");
                setFollowerMin("");
                setFollowerMax("");
              }} />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {FOLLOWER_RANGES.map((range) => (
              <Chip
                key={range.id}
                label={range.label}
                active={selectedFollowers === range.id}
                onClick={() => setSelectedFollowers(range.id)}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">
                Min
              </label>
              <input
                type="text"
                placeholder="e.g. 1k"
                value={followerMin}
                onChange={(e) => setFollowerMin(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#666] uppercase tracking-wider mb-1.5 block">
                Max
              </label>
              <input
                type="text"
                placeholder="e.g. 1m"
                value={followerMax}
                onChange={(e) => setFollowerMax(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#3a3a3a] transition-colors"
              />
            </div>
          </div>
        </section>

        {/* MIN OUTLIER SCORE */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Min Outlier Score" />
            {selectedOutlier !== "any" && (
              <ClearButton onClick={() => setSelectedOutlier("any")} />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OUTLIER_RANGES.map((range) => (
              <Chip
                key={range.id}
                label={range.label}
                active={selectedOutlier === range.id}
                onClick={() => setSelectedOutlier(range.id)}
              />
            ))}
          </div>
        </section>

        {/* POSTED WITHIN */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <SectionHeader label="Posted Within" />
            {selectedTimePeriod !== "3months" && (
              <ClearButton onClick={() => setSelectedTimePeriod("all")} />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PERIODS.map((period) => (
              <Chip
                key={period.id}
                label={period.label}
                active={selectedTimePeriod === period.id}
                onClick={() => setSelectedTimePeriod(period.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
