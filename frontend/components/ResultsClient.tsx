"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  SearchX,
  Layers,
  Sparkles,
  ArrowRight,
  Share2,
  Check,
  X,
  ChevronDown,
} from "lucide-react";
import type { CompareResult } from "@/lib/types";
import {
  compareProducts,
  streamComparison,
  type AgentKey,
  type AgentStageEvent,
} from "@/lib/api";
import { getPriority } from "@/lib/priorities";
import { PRODUCT_CATEGORIES } from "@/lib/categories";
import {
  saveLastResult,
  addHistoryEntry,
  addRecentSearch,
} from "@/lib/storage";
import SearchBar from "./SearchBar";
import AgentPipeline, { type LiveAgentState } from "./AgentPipeline";
import TopRecommendation from "./TopRecommendation";
import AlternativeCard from "./AlternativeCard";

const AGENT_ORDER: AgentKey[] = ["search", "review", "ranking"];

const AGENT_ACTIVE_MSG: Record<AgentKey, string> = {
  search: "Scanning major retailers…",
  review: "Reading customer reviews…",
  ranking: "Ranking the best options…",
};

type LiveStages = Record<AgentKey, LiveAgentState>;

function initialLiveStages(): LiveStages {
  return {
    search: { status: "active", message: AGENT_ACTIVE_MSG.search },
    review: { status: "pending", message: "Queued" },
    ranking: { status: "pending", message: "Queued" },
  };
}

function advanceStages(prev: LiveStages, event: AgentStageEvent): LiveStages {
  const next: LiveStages = {
    ...prev,
    [event.agent]: { status: event.status, message: event.message },
  };
  // When an agent finishes, optimistically light up the next one so the UI
  // keeps moving during LLM latency between tool calls.
  if (event.status === "done") {
    const idx = AGENT_ORDER.indexOf(event.agent);
    const nextAgent = AGENT_ORDER[idx + 1];
    if (nextAgent && next[nextAgent].status === "pending") {
      next[nextAgent] = { status: "active", message: AGENT_ACTIVE_MSG[nextAgent] };
    }
  }
  return next;
}

export default function ResultsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const query = params.get("q")?.trim() ?? "";
  const priority = params.get("priority") ?? "lowest_price";
  const budgetParam = params.get("budget")?.trim() ?? "";
  const categoryParam = params.get("category")?.trim() ?? "";
  const budgetValue = parseBudget(budgetParam);
  const budgetLabel = formatBudgetLabel(budgetParam, budgetValue);
  const priorityConf = getPriority(priority);

  const [phase, setPhase] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [manualShareUrl, setManualShareUrl] = useState<string | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [live, setLive] = useState<LiveStages>(initialLiveStages);

  useEffect(() => {
    if (!query) {
      setPhase("idle");
      return;
    }

    setPhase("loading");
    setResult(null);
    setError(null);
    setLive(initialLiveStages());

    let cancelled = false;
    let gotResult = false;
    const controller = new AbortController();

    const finishResult = (data: CompareResult) => {
      if (cancelled) return;
      gotResult = true;
      setResult(data);
      setPhase("done");
      saveLastResult(data);
      addRecentSearch(query, priority);
      addHistoryEntry({
        product: query,
        priority,
        category: data.category,
        totalFound: data.total_found,
      });
    };

    // Plain (non-streaming) request used only if the SSE transport fails before
    // delivering a result — keeps results working behind buffering proxies.
    const fallback = async () => {
      try {
        const data = await compareProducts(
          query,
          priority,
          categoryParam,
          controller.signal
        );
        finishResult(data);
      } catch (err) {
        if (
          cancelled ||
          controller.signal.aborted ||
          (err instanceof Error && err.name === "AbortError")
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : "Something went wrong");
        setPhase("error");
      }
    };

    const closeStream = streamComparison(query, priority, categoryParam, {
      onStage: (stage) => {
        if (cancelled) return;
        setLive((prev) => advanceStages(prev, stage));
      },
      onResult: (data) => finishResult(data),
      onError: () => {
        if (cancelled || gotResult) return;
        void fallback();
      },
    });

    return () => {
      cancelled = true;
      closeStream();
      controller.abort(new DOMException("ResultsClient cleanup", "AbortError"));
    };
  }, [query, priority, categoryParam]);

  const alternatives = result?.results.filter((p) => p.rank !== 1) ?? [];
  const topPick =
    result?.top_pick ?? result?.results.find((p) => p.rank === 1) ?? null;
  const clearBudgetHref = buildResultsPath(
    query,
    priority,
    undefined,
    categoryParam
  );

  const changeCategory = (category: string) => {
    setCategoryOpen(false);
    router.push(buildResultsPath(query, priority, budgetParam, category));
  };

  const shareResults = async () => {
    const url = `${window.location.origin}${buildResultsPath(
      query,
      priority,
      budgetParam,
      categoryParam
    )}`;

    try {
      await navigator.clipboard.writeText(url);
          setShareCopied(true);
          setManualShareUrl(null);
          window.setTimeout(() => setShareCopied(false), 1800);
        } catch {
          setManualShareUrl(url);
        }
      };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-12">
      {/* Sticky-ish search header */}
      <div className="glass-strong sticky top-[72px] z-30 rounded-3xl p-4 shadow-soft">
        <SearchBar
          size="sm"
          initialQuery={query}
          initialPriority={priority}
          initialBudget={budgetParam}
          showPriorities
          prioritiesVariant="segmented"
        />
      </div>

      {phase === "idle" && (
        <EmptyPrompt />
      )}

      {phase === "loading" && (
        <AgentPipeline
          query={query}
          priorityLabel={priorityConf.label}
          live={live}
        />
      )}

      {phase === "error" && (
        <div className="card-base mx-auto mt-10 max-w-lg p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">Something went wrong</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{error}</p>
          <Link
            href="/"
            className="bg-gradient-brand mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
          >
            Back to search
          </Link>
        </div>
      )}

      {phase === "done" && result && (
        <div className="animate-fade-up mt-8">
          {result.total_found === 0 || !topPick ? (
            <div className="card-base mx-auto max-w-lg p-8 text-center">
              <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)]">
                <SearchX className="h-6 w-6" />
              </div>
              <h2 className="text-lg font-bold">No products found</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                {result.justification ||
                  "Try a different search term or adjust your priority."}
              </p>
            </div>
          ) : (
            <>
              {/* header */}
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Results for{" "}
                    <span className="text-gradient">
                      &ldquo;{result.product_query}&rdquo;
                    </span>
                  </h1>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">
                    {result.total_found} products compared
                    {" "}· optimized
                    for {priorityConf.label}
                  </p>
                  {result.category && (
                    <div className="relative mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm font-semibold text-[var(--color-primary)]">
                        {result.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCategoryOpen((open) => !open)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white/70 px-3 py-1 text-sm font-semibold text-[var(--color-text)] transition-all hover:-translate-y-0.5 hover:shadow-soft"
                      >
                        Change Category
                        <ChevronDown className="h-4 w-4 text-[var(--color-primary)]" />
                      </button>
                      {categoryOpen && (
                        <div className="absolute left-0 top-10 z-40 grid max-h-72 w-64 gap-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-2 shadow-lift">
                          {PRODUCT_CATEGORIES.map((category) => (
                            <button
                              key={category}
                              type="button"
                              onClick={() => changeCategory(category)}
                              className={`rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                                category === result.category
                                  ? "bg-gradient-brand-soft text-[var(--color-primary)]"
                                  : "text-[var(--color-text)] hover:bg-[var(--color-primary)]/8"
                              }`}
                            >
                              {category}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {budgetLabel && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-[var(--color-success)]/12 px-3 py-1 font-semibold text-[var(--color-success)]">
                        Showing results up to {budgetLabel}
                      </span>
                      <Link
                        href={clearBudgetHref}
                        className="font-semibold text-[var(--color-primary)] hover:underline"
                      >
                        Clear budget
                      </Link>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={shareResults}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    {shareCopied ? (
                      <Check className="h-4 w-4 text-[var(--color-success)]" />
                    ) : (
                      <Share2 className="h-4 w-4 text-[var(--color-primary)]" />
                    )}
                    {shareCopied ? "Copied!" : "Share Results"}
                  </button>
                  <Link
                    href="/compare"
                    className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <Layers className="h-4 w-4 text-[var(--color-primary)]" />
                    Compare side by side
                  </Link>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <TopRecommendation
                    product={topPick}
                    justification={result.justification}
                    budget={budgetValue}
                  />
                </div>
                <div className="space-y-4">
                  <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--color-muted)]">
                    <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
                    Alternatives
                  </h2>
                  {alternatives.length === 0 ? (
                    <p className="text-sm text-[var(--color-muted)]">
                      No alternatives for this search.
                    </p>
                  ) : (
                    alternatives.map((p) => (
                      <AlternativeCard
                        key={p.url + p.rank}
                        product={p}
                        budget={budgetValue}
                      />
                    ))
                  )}
                </div>
              </div>
              {manualShareUrl && (
                <div className="mt-5 rounded-2xl border border-[var(--color-border)] bg-white/80 p-4 text-sm shadow-soft">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--color-text)]">
                        Copy this results link
                      </p>
                      <p className="mt-1 break-all text-[var(--color-muted)]">
                        {manualShareUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManualShareUrl(null)}
                      aria-label="Dismiss share link"
                      className="rounded-full p-1.5 text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}

function parseBudget(value: string): number | null {
  const normalized = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const budget = Number(normalized[0]);
  return Number.isFinite(budget) && budget > 0 ? budget : null;
}

function formatBudgetLabel(raw: string, value: number | null): string | null {
  if (value === null) return null;
  const trimmed = raw.trim();
  if (trimmed) return trimmed;
  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function buildResultsPath(
  query: string,
  priority: string,
  budget?: string,
  category?: string
): string {
  const params = new URLSearchParams({ q: query, priority });
  const normalizedBudget = budget?.trim();
  const normalizedCategory = category?.trim();
  if (normalizedBudget) params.set("budget", normalizedBudget);
  if (normalizedCategory) params.set("category", normalizedCategory);
  return `/results?${params.toString()}`;
}

function EmptyPrompt() {
  return (
    <div className="card-base mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)]">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold">Start a comparison</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Search for a product above and let our AI agents do the work.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]"
      >
        Go to home
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
