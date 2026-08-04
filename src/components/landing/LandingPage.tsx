"use client";

import { useEffect, useRef, useState } from "react";
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

const BEFORE_AFTER = {
  before: [
    "Staring at a blank page for hours",
    "Copying templates that feel lifeless",
    "Juggling 6 tools for one video",
    "Guessing what the algorithm wants",
    "Writing in a voice that isn't yours",
  ],
  after: [
    "Signal-driven content every time",
    "Structure decoded from viral hits",
    "One loop: discover → forge → ship",
    "SEO tuned to what's ranking now",
    "Your voice, trained and amplified",
  ],
};

const STEPS = [
  { step: "Discover", text: "Search a niche or paste a creator. Outlierly surfaces outliers, not just popular videos." },
  { step: "Decode", text: "Get a structural breakdown — hook, pace, title pattern, thumbnail contrast." },
  { step: "Forge", text: "Generate a script, social posts, and SEO in your trained voice. Edit inline." },
  { step: "Ship", text: "Export, publish, then import performance back in. The loop tightens every cycle." },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const hero = useReveal();
  const problem = useReveal();
  const features = useReveal();
  const steps = useReveal();
  const cta = useReveal();

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
      <header className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center max-w-7xl mx-auto px-4 md:px-6 pt-12 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/60 mb-6 transition-all duration-700 ${
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
              className={`text-5xl md:text-6xl xl:text-7xl font-semibold tracking-[-0.04em] leading-[0.95] mb-6 transition-all duration-700 delay-75 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              Stop guessing.
              <br />
              <span className="text-white/40">Start </span>
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                forging
              </span>{" "}
              content.
            </h1>

            <p
              className={`text-base md:text-lg text-white/50 max-w-lg mb-8 leading-relaxed transition-all duration-700 delay-150 ${
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
              }`}
            >
              Outlierly reads the YouTube graph, decodes why things go viral, and
              hands you scripts, posts, and SEO in your own voice — so every upload
              starts from signal, not a blank page.
            </p>

            <div
              className={`flex flex-col sm:flex-row gap-3 mb-6 transition-all duration-700 delay-300 ${
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
                onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-white/15 bg-transparent text-white hover:bg-white/5 hover:border-white/25 hover:text-white h-12 px-7 text-base"
              >
                See how it works
              </Button>
            </div>

            <p className="text-xs text-white/30">
              No credit card · Free during V1 · Your data stays yours
            </p>
          </div>

          {/* Product mockup */}
          <div
            className={`hidden lg:block relative transition-all duration-1000 delay-500 ${
              mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-400/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
                </div>
                <span className="text-[10px] text-white/30 ml-2">Outlierly — Discover</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                  <div className="w-20 h-12 rounded bg-emerald-400/20 flex items-center justify-center text-xs text-emerald-300">▶</div>
                  <div className="flex-1">
                    <div className="h-2.5 w-3/4 bg-white/20 rounded mb-1.5" />
                    <div className="h-2 w-1/2 bg-white/10 rounded" />
                  </div>
                  <span className="text-xs text-emerald-400 font-mono">94</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                  <div className="w-20 h-12 rounded bg-violet-400/20 flex items-center justify-center text-xs text-violet-300">▶</div>
                  <div className="flex-1">
                    <div className="h-2.5 w-2/3 bg-white/20 rounded mb-1.5" />
                    <div className="h-2 w-1/3 bg-white/10 rounded" />
                  </div>
                  <span className="text-xs text-violet-400 font-mono">87</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.04] border border-white/5">
                  <div className="w-20 h-12 rounded bg-amber-400/20 flex items-center justify-center text-xs text-amber-300">▶</div>
                  <div className="flex-1">
                    <div className="h-2.5 w-4/5 bg-white/20 rounded mb-1.5" />
                    <div className="h-2 w-2/5 bg-white/10 rounded" />
                  </div>
                  <span className="text-xs text-amber-400 font-mono">91</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[10px] text-white/30">
                <span>3 outliers found</span>
                <span>Updated just now</span>
              </div>
            </div>
            <div className="absolute -inset-4 -z-10 bg-gradient-to-br from-emerald-500/20 via-transparent to-cyan-500/20 rounded-3xl blur-2xl" />
          </div>
        </div>

        {/* Live signal ticker */}
        <div className="mt-16 md:mt-20 relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              live signal feed
            </span>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <div className="flex animate-marquee whitespace-nowrap py-3">
              {[...SIGNALS, ...SIGNALS].map((s, i) => (
                <span key={i} className="mx-6 text-sm text-white/50 font-mono">
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

      {/* Social Proof */}
      <section ref={hero.ref} className="relative max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div
          className={`flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 transition-all duration-700 ${
            hero.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-[#070708] bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 flex items-center justify-center text-[10px] text-white/60"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <p className="text-sm text-white/40 text-center md:text-left">
            <span className="text-white/60 font-medium">1,000+ creators</span> use Outlierly to find signals and forge content
          </p>
          <div className="flex items-center gap-3 text-white/30">
            <span className="text-xs">Works with</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section ref={problem.ref} className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 transition-all duration-700 ${
            problem.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.03] p-8">
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <h3 className="text-sm font-medium text-red-300 uppercase tracking-wider">Before Outlierly</h3>
            </div>
            <ul className="space-y-4">
              {BEFORE_AFTER.before.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/50">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.03] p-8">
            <div className="flex items-center gap-2 mb-6">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-sm font-medium text-emerald-300 uppercase tracking-wider">After Outlierly</h3>
            </div>
            <ul className="space-y-4">
              {BEFORE_AFTER.after.map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/70">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Features — Interactive Tabs */}
      <section id="features" ref={features.ref} className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div
          className={`transition-all duration-700 ${
            features.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="mb-12">
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/70">
              the loop
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mt-2">
              Four moves. One feedback loop.
            </h2>
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            {FEATURES.map((f, i) => {
              const a = ACCENT[f.accent];
              const active = activeFeature === i;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFeature(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 border cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                    active
                      ? `${a.border} ${a.bg} ${a.text}`
                      : "border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
                  }`}
                >
                  {f.tag}
                </button>
              );
            })}
          </div>

          <div className="relative rounded-2xl border border-white/10 bg-white/[0.02] p-8 md:p-12 transition-all duration-500">
            {(() => {
              const f = FEATURES[activeFeature];
              const a = ACCENT[f.accent];
              return (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-medium tracking-tight mb-4">
                      {f.title}
                    </h3>
                    <p className="text-white/50 leading-relaxed mb-6 max-w-lg">{f.body}</p>
                    <div className={`inline-flex items-baseline gap-1.5 ${a.bg} px-3 py-1.5 rounded-md`}>
                      <span className={`text-xl font-semibold ${a.text}`}>{f.metricValue}</span>
                      <span className="text-[10px] uppercase tracking-wider text-white/40">{f.metric}</span>
                    </div>
                  </div>
                  <div className={`rounded-xl border ${a.border} ${a.bg} p-6 ${a.glow} transition-all duration-500`}>
                    <div className="space-y-3">
                      <div className="h-2 w-full bg-white/10 rounded" />
                      <div className="h-2 w-3/4 bg-white/10 rounded" />
                      <div className="h-2 w-5/6 bg-white/10 rounded" />
                      <div className="h-20 mt-4 rounded-lg bg-white/[0.05] flex items-center justify-center">
                        <span className={`text-3xl font-bold ${a.text}`}>{f.metricValue}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section ref={steps.ref} className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <div
          className={`transition-all duration-700 ${
            steps.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="text-center mb-16">
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-400/70">
              the path
            </span>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mt-2">
              From blank page to published
            </h2>
          </div>

          <div className="hidden md:block">
            <div className="relative flex items-start justify-between">
              <div className="absolute top-6 left-[12%] right-[12%] h-px bg-gradient-to-r from-emerald-400/40 via-white/20 to-emerald-400/40" />
              {STEPS.map((s, i) => (
                <div key={s.step} className="relative flex flex-col items-center text-center z-10" style={{ width: "22%" }}>
                  <div className="w-12 h-12 rounded-full border border-emerald-400/40 bg-[#070708] flex items-center justify-center text-sm font-mono text-emerald-400 mb-4">
                    {i + 1}
                  </div>
                  <h3 className="text-base font-medium mb-2">{s.step}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="md:hidden">
            <ol className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-400/60 via-white/10 to-transparent" />
              {STEPS.map((s, i) => (
                <li key={s.step} className="relative pl-14 pb-8 last:pb-0">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400/40 bg-[#070708] text-xs font-mono text-emerald-400">
                    {i + 1}
                  </div>
                  <h3 className="text-base font-medium mb-1">{s.step}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section ref={cta.ref} className="relative max-w-7xl mx-auto px-4 md:px-6 py-20 md:py-32">
        <div
          className={`relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-transparent to-cyan-500/10 p-10 md:p-20 text-center transition-all duration-700 ${
            cta.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-emerald-400/20 blur-[120px]" />
            <div className="absolute -bottom-20 left-1/4 h-60 w-60 rounded-full bg-cyan-400/20 blur-[100px]" />
          </div>
          <div className="relative">
            <ForgeMark className="mx-auto mb-6" />
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">
              Your next hit isn&apos;t luck.
            </h2>
            <p className="text-white/50 max-w-lg mx-auto mb-2">
              It&apos;s structure, decoded and handed back to you in your own voice.
            </p>
            <p className="text-sm text-emerald-400/70 mb-8">
              Join 1,000+ creators who refuse to guess.
            </p>
            <Button
              size="lg"
              onClick={() => router.push("/auth/signup")}
              className="bg-white text-[#070708] hover:bg-white/90 h-14 px-10 text-lg font-medium"
            >
              Forge my first piece →
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ForgeMark />
                <span className="text-sm font-medium">Outlierly</span>
              </div>
              <p className="text-xs text-white/30">
                Content intelligence for creators who refuse to guess.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Product</h4>
              <ul className="space-y-2">
                {["Discover", "Create", "Optimize", "Analyze"].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => router.push("/discover")}
                      className="text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Resources</h4>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-xs text-white/40 hover:text-white/70 transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/Sabbir505/Content-management"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    GitHub
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Company</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://x.com/Sabbirbyte"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/40 hover:text-white/70 transition-colors"
                  >
                    Twitter / X
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5">
            <p className="text-xs text-white/30 font-mono">
              v1.0 · built for creators who refuse to guess
            </p>
            <p className="text-xs text-white/20">
              © 2026 Outlierly. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

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
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none">
        <defs>
          <linearGradient id="forgeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path
          d="M16 2 L28 9 L28 23 L16 30 L4 23 L4 9 Z"
          fill="url(#forgeGrad)"
          opacity="0.15"
          stroke="url(#forgeGrad)"
          strokeWidth="1.5"
        />
        <path
          d="M16 10 L22 14 L22 20 L16 24 L10 20 L10 14 Z"
          fill="url(#forgeGrad)"
          opacity="0.9"
        />
        <path
          d="M16 12 L20 15 L16 22 L12 15 Z"
          fill="#070708"
        />
      </svg>
    </span>
  );
}
