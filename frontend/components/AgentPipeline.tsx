"use client";

import { useEffect, useState } from "react";
import { Search, MessageSquareText, Trophy, Check, Loader2 } from "lucide-react";
import type { AgentKey, AgentStatus } from "@/lib/api";

interface Stage {
  key: AgentKey;
  icon: typeof Search;
  title: string;
  messages: string[];
}

const STAGES: Stage[] = [
  {
    key: "search",
    icon: Search,
    title: "Search Agent",
    messages: [
      "Scanning major retailers…",
      "Collecting live listings…",
      "Found matching products",
    ],
  },
  {
    key: "review",
    icon: MessageSquareText,
    title: "Review Agent",
    messages: [
      "Reading customer reviews…",
      "Scoring sentiment & quality…",
      "Review analysis complete",
    ],
  },
  {
    key: "ranking",
    icon: Trophy,
    title: "Ranking Agent",
    messages: [
      "Weighing your priority…",
      "Ranking the best options…",
      "Recommendation ready",
    ],
  },
];

export interface LiveAgentState {
  status: AgentStatus;
  message: string;
}

interface Props {
  query: string;
  priorityLabel: string;
  /**
   * Real-time agent state from the SSE stream. When provided, stages render
   * from live data; otherwise a cosmetic animation runs as a fallback.
   */
  live?: Record<AgentKey, LiveAgentState>;
}

export default function AgentPipeline({ query, priorityLabel, live }: Props) {
  // Cosmetic fallback animation (used only when no live data is supplied).
  // active: index currently working; completed stages are < active
  const [active, setActive] = useState(0);
  const [msgStep, setMsgStep] = useState(0);

  useEffect(() => {
    if (live) return;
    const interval = setInterval(() => {
      setMsgStep((m) => {
        if (m < 2) return m + 1;
        // advance stage
        setActive((a) => Math.min(a + 1, STAGES.length - 1));
        return 0;
      });
    }, 750);
    return () => clearInterval(interval);
  }, [live]);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="mb-8 text-center">
        <div className="bg-gradient-brand-soft mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-[var(--color-primary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI agents at work
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          Analyzing{" "}
          <span className="text-gradient">&ldquo;{query}&rdquo;</span>
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Optimizing for {priorityLabel}
        </p>
      </div>

      <div className="relative space-y-3">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const liveState = live?.[stage.key];
          const status: AgentStatus = liveState
            ? liveState.status
            : i < active
              ? "done"
              : i === active
                ? "active"
                : "pending";
          const message = liveState
            ? liveState.message
            : status === "done"
              ? stage.messages[2]
              : status === "active"
                ? stage.messages[msgStep]
                : "Queued";

          return (
            <div
              key={stage.title}
              className={`card-base flex items-center gap-4 p-4 transition-all duration-500 ${
                status === "active"
                  ? "glow-ring scale-[1.01]"
                  : status === "pending"
                    ? "opacity-55"
                    : ""
              }`}
            >
              <span
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl transition-all duration-500 ${
                  status === "done"
                    ? "bg-[var(--color-success)] text-white"
                    : status === "active"
                      ? "bg-gradient-brand text-white"
                      : "bg-[var(--color-primary)]/8 text-[var(--color-muted)]"
                }`}
              >
                {status === "done" ? (
                  <Check className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <Icon className="h-5 w-5" strokeWidth={2} />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{stage.title}</p>
                  {status === "active" && (
                    <Loader2 className="h-4 w-4 animate-spin text-[var(--color-primary)]" />
                  )}
                  {status === "done" && (
                    <span className="text-xs font-semibold text-[var(--color-success)]">
                      Done
                    </span>
                  )}
                </div>
                <p
                  key={message}
                  className="animate-fade-in mt-0.5 truncate text-sm text-[var(--color-muted)]"
                >
                  {message}
                </p>
                {/* progress bar */}
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-primary)]/8">
                  <div
                    className={`bg-gradient-brand h-full rounded-full transition-all duration-700 ${
                      status === "done"
                        ? "w-full"
                        : status === "active"
                          ? "w-2/3 animate-pulse-soft"
                          : "w-0"
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
