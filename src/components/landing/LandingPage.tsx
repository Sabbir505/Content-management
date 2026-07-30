"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const SIGNALS = [
  "1.2M views in 9 days",
  "Hook: 0.8s retention",
  "Niche: Personal Finance",
  "Outlier score 94",
  "Title pattern: question + number",
  "Pace: 142 wpm",
  "Thumbnail contrast 0.71",
  "Comment velocity +320%",
  "Topic cluster: compounding",
  "Voice match 87%",
];

const FEATURES = [
  {
    key: "discover",
    tag: "01 — Signal",
    title: "Find what's already winning",
    body: "Pull trending videos from any niche, decode why they broke out, and surface the outliers your competitors miss. Not by views — by structure.",
    metric: "Outlier score",
    metricValue: "94",
    accent: "emerald",
  },
  {
    key: "create",
    tag: "02 — Voice",
    title: "Write in your voice, not a template's",
    body: "Train the model on your past work. Scripts, posts, and threads come out sounding like you wrote them at 2am — because it learned how you actually write.",
    metric: "Voice match",
    metricValue: "87%",
    accent: "violet",
  },
  {
    key: "optimize",
    tag: "03 — Reach",
    title: "SEO that survives the algorithm",
    body: "Titles, descriptions, tags, and thumbnail concepts generated against what's ranking right now — not a stale playbook from 2022.",
    metric: "Search surface",
    metricValue: "+3x",
    accent: "amber",
  },
  {
    key: "analyze",
    tag: "04 — Feedback",
    title: "Your channel, decoded",
    body: "Import your channel, get a performance breakdown by video, and a clear answer to the only question that matters: what do I double down on?",
    metric: "Decisions/week",
    metricValue: "12",
    accent: "cyan",
  },
] as const;

const ACCENT: Record<string, { text: string; bg: string; border: string; dot: string; glow: string }> = {
  emerald: {
    text: "text-emerald-300",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    dot: "bg-emerald-400",
    glow: "shadow-[0_0_40px_-12px_rgba(52,211,153,0.5)]",
  },
  violet: {
    text: "text-violet-300",
    bg: "bg-violet-400/10",
    border: "border-violet-400/30",
    dot: "bg-violet-400",
    glow: "shadow-[0_0_40px_-12px_rgba(167,139,250,0.5)]",
  },
  amber: {
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    border: "border-amber-400/30",
    dot: "bg-amber-400",
    glow: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)]",
  },
  cyan: {
    text: "text-cyan-300",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/30",
    dot: "bg-cyan-400",
    glow: "shadow-[0_0_40px_-12px_rgba(34,211,238,0.5)]",
  },
};

export function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Defer to avoid setState synchronously within the effect (react-hooks/set-state-in-effect)
    queueMicrotask(() => setMounted(true));
  }, []);

  return (
    <div className="min-h-screen bg-[#070708] text-white overflow-x-hidden selection:bg-emerald-400/30">
      {/* Ambient mesh background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-emerald-500/15 blur-[120px] animate-pulse-slow" />
        <div className="absolute top-1/3 -right-40 h-[30rem] w-[30rem] rounded-full bg-violet-500/15 blur-[120px] animate-pulse-slow-delayed" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "4rem 4rem",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-[#070708]/60 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ForgeMark />
            <span className="text-base font-semibold tracking-tight">Outlierly</span>
            <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-white/30 ml-1">
              content intelligence
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/auth/login")}
              className="text-sm text-white/70 hover:text-white transition-colors px-3 py-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded"
            >
              Sign in
            </button>
            <Button
              size="sm"
              onClick={() => router.push("/auth/signup")}
              className="bg-white text-[#070708] hover:bg-white/90"
            >
              Start free
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative max-w-7xl mx-auto px-4 md:px-6 pt-16 md:pt-28 pb-20">
        <div className="max-w-3xl">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/60 mb-8 transition-all duration-700 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            V1 Core — live now
          </div>

          <h1
            className={`text-5xl md:text-7xl font-semibold tracking-[-0.04em] leading-[0.95] mb-6 transition-all duration-700 delay-75 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            Stop guessing.
            <br />
            <span className="text-white/40">Start </span>
            <span className="relative">
              forging
              <svg
                className="absolute -bottom-2 left-0 w-full"
                viewBox="0 0 200 8"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M2 6 Q 50 1, 100 4 T 198 5"
                  fill="none"
                  stroke="url(#underline)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="underline" x1="0" x2="1">
                    <stop offset="0" stopColor="#34d399" />
                    <stop offset="1" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
            </span>{" "}
            content.
          </h1>

          <p
            className={`text-base md:text-lg text-white/50 max-w-xl mb-10 leading-relaxed transition-all duration-700 delay-150 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            Outlierly reads the YouTube graph, decodes why things go viral, and
            hands you scripts, posts, and SEO in your own voice — so every upload
            starts from signal, not a blank page.
          </p>

          <div
            className={`flex flex-col sm:flex-row gap-3 mb-12 transition-all duration-700 delay-300 ${
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
            }`}
          >
            <Button
              size="lg"
              onClick={() => router.push("/auth/signup")}
              className="bg-emerald-400 text-[#070708] hover:bg-emerald-300 h-12 px-7 text-base font-medium"
            >
              Forge your first piece →
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => router.push("/auth/login")}
              className="border border-white/15 bg-transparent text-white hover:bg-white/5 hover:border-white/25 hover:text-white h-12 px-7 text-base"
            >
              I already have an account
            </Button>
          </div>

          <p className="text-xs text-white/30">
            No credit card · Free during V1 · Your data stays yours
          </p>
        </div>

        {/* Live signal ticker */}
        <div className="mt-16 md:mt-24 relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              live signal feed
            </span>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex animate-marquee whitespace-nowrap py-3">
              {[...SIGNALS, ...SIGNALS].map((s, i) => (
                <span
                  key={i}
                  className="mx-6 text-sm text-white/50 font-mono"
                >
                  <span className="text-emerald-400/70 mr-2">▸</span>
                  {s}
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#070708] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#070708] to-transparent" />
          </div>
        </div>
      </header>

      {/* The problem — a pull quote band */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div className="border-y border-white/5 py-12">
          <p className="text-2xl md:text-4xl font-medium tracking-tight leading-snug max-w-4xl">
            <span className="text-white/35">Every creator hits the same wall:</span>{" "}
            <span className="text-white">
              you know what to make, but not how it becomes a hit.
            </span>{" "}
            <span className="text-white/35">
              Outlierly is the wall coming down.
            </span>
          </p>
        </div>
      </section>

      {/* Features — asymmetric bento */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-6 pb-20">
        <div className="mb-12">
          <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/70">
            the loop
          </span>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mt-2">
            Four moves. One feedback loop.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f) => {
            const a = ACCENT[f.accent];
            return (
              <article
                key={f.key}
                className={`group relative rounded-2xl border ${a.border} bg-white/[0.02] p-7 md:p-9 transition-all duration-300 hover:bg-white/[0.04] hover:${a.glow}`}
              >
                <div className="flex items-start justify-between mb-8">
                  <span className={`text-[10px] uppercase tracking-[0.25em] ${a.text}`}>
                    {f.tag}
                  </span>
                  <div className={`flex items-baseline gap-1.5 ${a.bg} px-2.5 py-1 rounded-md`}>
                    <span className={`text-lg font-semibold ${a.text}`}>{f.metricValue}</span>
                    <span className="text-[9px] uppercase tracking-wider text-white/40">
                      {f.metric}
                    </span>
                  </div>
                </div>
                <h3 className="text-xl md:text-2xl font-medium tracking-tight mb-3 leading-snug">
                  {f.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">{f.body}</p>
                <div className="mt-6 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
                  <span className="text-xs text-white/40 group-hover:text-white/60 transition-colors">
                    {f.key === "discover" && "Trending → outlier → structure"}
                    {f.key === "create" && "Voice profile → script → post"}
                    {f.key === "optimize" && "Ranking data → title → thumbnail"}
                    {f.key === "analyze" && "Channel import → score → decision"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works — vertical steps */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20">
          <div>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/70">
              the path
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mt-2 mb-4 leading-tight">
              From blank page to published,
              <br />
              in one sitting.
            </h2>
            <p className="text-white/50 leading-relaxed max-w-md">
              No tab juggling. No copy-paste between six tools. The whole loop lives
              here — and the more you use it, the sharper your voice profile gets.
            </p>
          </div>

          <ol className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/60 via-white/10 to-transparent" />
            {[
              {
                step: "Discover",
                text: "Search a niche or paste a creator. Outlierly surfaces outliers, not just popular videos.",
              },
              {
                step: "Decode",
                text: "Get a structural breakdown — hook, pace, title pattern, thumbnail contrast — the stuff that actually predicts performance.",
              },
              {
                step: "Forge",
                text: "Generate a script, social posts, and SEO in your trained voice. Edit inline, regenerate sections.",
              },
              {
                step: "Ship",
                text: "Export, publish, then import performance back in. The loop tightens on itself every cycle.",
              },
            ].map((s, i) => (
              <li key={s.step} className="relative pl-12 pb-8 last:pb-0">
                <div className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#070708] text-xs font-mono text-white/60">
                  {i + 1}
                </div>
                <h3 className="text-base font-medium mb-1">{s.step}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 p-10 md:p-16 text-center">
          <div className="pointer-events-none absolute inset-0 opacity-30">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-60 w-60 rounded-full bg-emerald-400/30 blur-[100px]" />
          </div>
          <div className="relative">
            <ForgeMark className="mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">
              Your next hit isn&apos;t luck.
            </h2>
            <p className="text-white/50 max-w-lg mx-auto mb-8">
              It&apos;s structure, decoded and handed back to you in your own voice.
              Start in two minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={() => router.push("/auth/signup")}
                className="bg-white text-[#070708] hover:bg-white/90 h-12 px-7 text-base font-medium"
              >
                Forge my first piece
              </Button>
              <Button
                size="lg"
                variant="ghost"
                onClick={() => router.push("/auth/login")}
                className="border border-white/15 bg-transparent text-white hover:bg-white/5 hover:text-white h-12 px-7 text-base"
              >
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ForgeMark />
            <span className="text-sm font-medium">Outlierly</span>
            <span className="text-xs text-white/30">· content intelligence</span>
          </div>
          <p className="text-xs text-white/30 font-mono">
            v1.0 · built for creators who refuse to guess
          </p>
        </div>
      </footer>

      {/* Inline style block for keyframes (Tailwind v4 lacks custom keyframes without config) */}
      <style>{`
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .animate-marquee { animation: marquee 40s linear infinite; }
        @keyframes pulse-slow { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        .animate-pulse-slow { animation: pulse-slow 8s ease-in-out infinite; }
        .animate-pulse-slow-delayed { animation: pulse-slow 8s ease-in-out infinite; animation-delay: 4s; }
      `}</style>
    </div>
  );
}

function ForgeMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex h-7 w-7 items-center justify-center ${className}`}
      aria-hidden
    >
      <span className="absolute inset-0 rounded-md bg-gradient-to-br from-emerald-400 to-cyan-400 opacity-90" />
      <svg viewBox="0 0 24 24" className="relative h-4 w-4 text-[#070708]" fill="none">
        <path
          d="M4 14 L9 9 L13 13 L20 6"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="6" r="2" fill="currentColor" />
      </svg>
    </span>
  );
}
