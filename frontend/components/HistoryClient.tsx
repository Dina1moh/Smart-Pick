"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History as HistoryIcon,
  RotateCcw,
  Trash2,
  Search,
  Calendar,
  Package,
} from "lucide-react";
import {
  getHistory,
  removeHistoryEntry,
  clearHistory,
  type HistoryEntry,
} from "@/lib/storage";
import { getPriority } from "@/lib/priorities";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryClient() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getHistory());
    setLoaded(true);
  }, []);

  const rerun = (e: HistoryEntry) =>
    router.push(
      `/results?q=${encodeURIComponent(e.product)}&priority=${e.priority}`
    );

  const remove = (id: string) => {
    removeHistoryEntry(id);
    setEntries(getHistory());
  };

  const clearAll = () => {
    clearHistory();
    setEntries([]);
  };

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pt-10 pb-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <HistoryIcon className="h-6 w-6 text-[var(--color-primary)]" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              Search history
            </h1>
          </div>
          <p className="text-[var(--color-muted)]">
            Revisit, re-run, or clear your previous comparisons.
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#E5547A] transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </button>
        )}
      </div>

      {loaded && entries.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)]">
            <Package className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">No history yet</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Your comparisons will appear here once you start searching.
          </p>
          <Link
            href="/"
            className="bg-gradient-brand mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
          >
            <Search className="h-4 w-4" />
            Start a search
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {entries.map((e) => {
            const p = getPriority(e.priority);
            const Icon = p.icon;
            return (
              <div
                key={e.id}
                className="card-base group flex flex-col gap-4 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold">{e.product}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(e.date)}
                    </div>
                  </div>
                  <span
                    className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                    style={{ background: `${p.accent}1f`, color: p.accent }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {p.label}
                  </span>
                </div>

                {(e.category || e.totalFound !== undefined) && (
                  <p className="text-sm text-[var(--color-muted)]">
                    {e.category ? `${e.category} · ` : ""}
                    {e.totalFound !== undefined
                      ? `${e.totalFound} products compared`
                      : ""}
                  </p>
                )}

                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => rerun(e)}
                    className="bg-gradient-brand inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Re-run
                  </button>
                  <button
                    onClick={() => remove(e.id)}
                    aria-label="Remove"
                    className="inline-flex items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/70 px-3.5 py-2.5 text-[var(--color-muted)] transition-all hover:-translate-y-0.5 hover:text-[#E5547A] hover:shadow-soft"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
