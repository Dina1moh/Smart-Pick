"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, Loader2, Wallet } from "lucide-react";
import PrioritySelector from "./PrioritySelector";
import { addRecentSearch } from "@/lib/storage";

const PLACEHOLDERS = [
  "MacBook Air M3",
  "Samsung Galaxy S25",
  "Sony WH-1000XM5",
  "PlayStation 5",
];

interface Props {
  initialQuery?: string;
  initialPriority?: string;
  initialBudget?: string;
  size?: "lg" | "sm";
  showPriorities?: boolean;
  prioritiesVariant?: "cards" | "segmented";
  autoFocus?: boolean;
}

export default function SearchBar({
  initialQuery = "",
  initialPriority = "lowest_price",
  initialBudget = "",
  size = "lg",
  showPriorities = true,
  prioritiesVariant = "cards",
  autoFocus = false,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [priority, setPriority] = useState(initialPriority);
  const [budget, setBudget] = useState(initialBudget);
  const [submitting, setSubmitting] = useState(false);

  // Cycling placeholder animation (only when input empty)
  const [phIndex, setPhIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query) return;
    const t = setInterval(() => {
      setPhIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 2600);
    return () => clearInterval(t);
  }, [query]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    addRecentSearch(q, priority);
    const params = new URLSearchParams({ q, priority });
    const normalizedBudget = budget.trim();
    if (normalizedBudget) params.set("budget", normalizedBudget);
    router.push(`/results?${params.toString()}`);
  };

  const lg = size === "lg";

  return (
    <form onSubmit={submit} className="w-full">
      <div
        className={`group relative ${lg ? "mx-auto max-w-2xl" : "w-full"}`}
      >
        <div
          className="bg-gradient-brand absolute -inset-0.5 rounded-[20px] opacity-0 blur-md transition-opacity duration-300 group-focus-within:opacity-60"
          aria-hidden
        />
        <div
          className={`glass-strong relative flex items-center rounded-[18px] shadow-card transition-all ${
            lg ? "pl-5 pr-2" : "pl-4 pr-2"
          }`}
        >
          <Search
            className="h-5 w-5 flex-shrink-0 text-[var(--color-muted)]"
            strokeWidth={2}
          />
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus={autoFocus}
              className={`w-full bg-transparent font-medium text-[var(--color-text)] outline-none placeholder:text-transparent ${
                lg ? "px-4 py-4 text-lg" : "px-3 py-3 text-base"
              }`}
              aria-label="Search for a product"
            />
            {!query && (
              <div
                className={`pointer-events-none absolute inset-0 flex items-center ${
                  lg ? "px-4 text-lg" : "px-3 text-base"
                }`}
              >
                <span className="text-[var(--color-muted)]">Search&nbsp;</span>
                <span
                  key={phIndex}
                  className="animate-fade-up font-medium text-[var(--color-primary)]"
                >
                  {PLACEHOLDERS[phIndex]}
                </span>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`bg-gradient-brand flex flex-shrink-0 items-center gap-2 rounded-[14px] font-semibold text-white shadow-soft transition-all hover:scale-[1.03] hover:shadow-lift active:scale-95 disabled:opacity-70 ${
              lg ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <span className="hidden sm:inline">Compare</span>
                <ArrowRight className="h-5 w-5" strokeWidth={2.2} />
              </>
            )}
          </button>
        </div>
      </div>

      {showPriorities && (
        <div className={lg ? "mt-8" : "mt-4"}>
          {prioritiesVariant === "cards" && (
            <p className="mb-3 text-center text-sm font-semibold text-[var(--color-muted)]">
              What matters most to you?
            </p>
          )}
          <PrioritySelector
            value={priority}
            onChange={setPriority}
            variant={prioritiesVariant}
          />
        </div>
      )}

      <div className={lg ? "mx-auto mt-4 max-w-xs" : "mt-3 max-w-xs"}>
        <label className="sr-only" htmlFor={`budget-${size}`}>
          Optional budget
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-3 py-2.5 shadow-soft">
          <Wallet className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
          <input
            id={`budget-${size}`}
            type="text"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g., $500 (optional)"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)]"
            aria-label="Optional maximum budget"
          />
        </div>
      </div>
    </form>
  );
}
