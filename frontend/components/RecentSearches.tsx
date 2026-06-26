"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, RotateCcw } from "lucide-react";
import { getRecentSearches, type RecentSearch } from "@/lib/storage";
import { getPriority } from "@/lib/priorities";

export default function RecentSearches() {
  const router = useRouter();
  const [recent, setRecent] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setRecent(getRecentSearches());
  }, []);

  if (recent.length === 0) return null;

  return (
    <section className="mx-auto mt-10 max-w-2xl">
      <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-[var(--color-muted)]">
        <Clock className="h-4 w-4" />
        Recent searches
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {recent.map((s, i) => {
          const p = getPriority(s.priority);
          return (
            <button
              key={`${s.product}-${i}`}
              onClick={() =>
                router.push(
                  `/results?q=${encodeURIComponent(s.product)}&priority=${s.priority}`
                )
              }
              className="group flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/70 px-4 py-2 text-sm font-medium text-[var(--color-text)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-soft"
            >
              <RotateCcw className="h-3.5 w-3.5 text-[var(--color-muted)] transition-colors group-hover:text-[var(--color-primary)]" />
              {s.product}
              <span className="text-xs text-[var(--color-muted)]">· {p.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
