"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Layers,
  Package,
  Plus,
  Check,
  Tag,
  Star,
  ShieldCheck,
  Truck,
  Smile,
  Sparkles,
  Trophy,
  ExternalLink,
  Search,
} from "lucide-react";
import type { CompareResult, Product } from "@/lib/types";
import { getLastResult } from "@/lib/storage";
import { formatPrice, getSentiment, getAIScore } from "@/lib/derive";
import StoreBadge from "./StoreBadge";
import StarRating from "./StarRating";

function deliveryDays(p: Product): number {
  if (!p.delivery) return 99;
  const m = p.delivery.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 5;
}
function warrantyMonths(p: Product): number {
  if (!p.warranty) return 0;
  const m = p.warranty.match(/(\d+)/);
  if (!m) return 6;
  const n = parseInt(m[1], 10);
  return /year/i.test(p.warranty) ? n * 12 : n;
}

type MetricKey =
  | "price"
  | "rating"
  | "warranty"
  | "delivery"
  | "sentiment"
  | "ai";

const METRICS: {
  key: MetricKey;
  label: string;
  icon: typeof Tag;
}[] = [
  { key: "price", label: "Price", icon: Tag },
  { key: "rating", label: "Rating", icon: Star },
  { key: "warranty", label: "Warranty", icon: ShieldCheck },
  { key: "delivery", label: "Delivery", icon: Truck },
  { key: "sentiment", label: "Sentiment", icon: Smile },
  { key: "ai", label: "AI Score", icon: Sparkles },
];

export default function CompareClient() {
  const [data, setData] = useState<CompareResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    const last = getLastResult();
    setData(last);
    setLoaded(true);
    if (last) {
      setSelected(last.results.slice(0, 3).map((p) => p.rank));
    }
  }, []);

  const products = useMemo(() => data?.results ?? [], [data]);
  const chosen = useMemo(
    () => products.filter((p) => selected.includes(p.rank)),
    [products, selected]
  );

  const best = useMemo(() => {
    if (chosen.length === 0) return {} as Record<MetricKey, number | null>;
    const priced = chosen.filter((p) => p.price !== null);
    const out: Record<MetricKey, number | null> = {
      price: priced.length
        ? priced.reduce((a, b) => (a.price! <= b.price! ? a : b)).rank
        : null,
      rating: chosen.reduce((a, b) => ((a.stars ?? 0) >= (b.stars ?? 0) ? a : b))
        .rank,
      warranty: chosen.reduce((a, b) =>
        warrantyMonths(a) >= warrantyMonths(b) ? a : b
      ).rank,
      delivery: chosen.reduce((a, b) =>
        deliveryDays(a) <= deliveryDays(b) ? a : b
      ).rank,
      sentiment: chosen.reduce((a, b) =>
        getSentiment(a).positive >= getSentiment(b).positive ? a : b
      ).rank,
      ai: chosen.reduce((a, b) => (getAIScore(a) >= getAIScore(b) ? a : b)).rank,
    };
    return out;
  }, [chosen]);

  const toggle = (rank: number) => {
    setSelected((prev) =>
      prev.includes(rank)
        ? prev.filter((r) => r !== rank)
        : prev.length >= 4
          ? prev
          : [...prev, rank]
    );
  };

  if (loaded && !data) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24 text-center">
        <div className="card-base p-8">
          <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)]">
            <Layers className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold">Nothing to compare yet</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Run a comparison first, then revisit this page to line products up
            side by side.
          </p>
          <Link
            href="/"
            className="bg-gradient-brand mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
          >
            <Search className="h-4 w-4" />
            Start a search
          </Link>
        </div>
      </main>
    );
  }

  const metricValue = (p: Product, key: MetricKey): React.ReactNode => {
    switch (key) {
      case "price":
        return (
          <span className="text-lg font-extrabold">{formatPrice(p)}</span>
        );
      case "rating":
        return <StarRating stars={p.stars} size={14} />;
      case "warranty":
        return <span>{p.warranty || "Not listed"}</span>;
      case "delivery":
        return <span>{p.delivery || "Standard"}</span>;
      case "sentiment":
        return <span>{getSentiment(p).positive}% positive</span>;
      case "ai":
        return (
          <span className="font-extrabold text-[var(--color-primary)]">
            {getAIScore(p)}
          </span>
        );
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-10 pb-16">
      <div className="mb-2 flex items-center gap-2">
        <Layers className="h-6 w-6 text-[var(--color-primary)]" />
        <h1 className="text-3xl font-extrabold tracking-tight">
          Compare side by side
        </h1>
      </div>
      <p className="mb-8 text-[var(--color-muted)]">
        Pick up to 4 products. Best value in each category is highlighted
        automatically.
      </p>

      {/* selector */}
      {products.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {products.map((p) => {
            const active = selected.includes(p.rank);
            return (
              <button
                key={p.url + p.rank}
                onClick={() => toggle(p.rank)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  active
                    ? "border-transparent bg-gradient-brand text-white shadow-soft"
                    : "border-[var(--color-border)] bg-white/70 hover:-translate-y-0.5 hover:shadow-soft"
                }`}
              >
                {active ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4 text-[var(--color-primary)]" />
                )}
                <span className="max-w-[180px] truncate">{p.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {chosen.length === 0 ? (
        <div className="card-base p-8 text-center text-sm text-[var(--color-muted)]">
          Select at least one product above to start comparing.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `minmax(120px, 0.6fr) repeat(${chosen.length}, minmax(200px, 1fr))`,
            }}
          >
            {/* header row */}
            <div />
            {chosen.map((p) => (
              <div
                key={`head-${p.rank}`}
                className="card-base relative flex flex-col items-center p-4 text-center"
              >
                {p.rank === 1 && (
                  <span className="bg-gradient-brand absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold text-white shadow-soft">
                    <Trophy className="h-3 w-3" />
                    TOP PICK
                  </span>
                )}
                <div className="relative mb-3 mt-1 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-soft">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.title}
                      fill
                      sizes="96px"
                      className="object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <Package className="h-8 w-8 text-[var(--color-border)]" />
                  )}
                </div>
                <StoreBadge url={p.url} source={p.source} />
                <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug">
                  {p.title}
                </h3>
              </div>
            ))}

            {/* metric rows */}
            {METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <FragmentRow key={metric.key}>
                  <div className="flex items-center gap-2 px-2 text-sm font-semibold text-[var(--color-muted)]">
                    <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                    {metric.label}
                  </div>
                  {chosen.map((p) => {
                    const isBest = best[metric.key] === p.rank;
                    return (
                      <div
                        key={`${metric.key}-${p.rank}`}
                        className={`flex items-center justify-center rounded-2xl border p-4 text-center text-sm transition-all ${
                          isBest
                            ? "border-[var(--color-success)]/40 bg-[var(--color-success)]/10"
                            : "border-[var(--color-border)] bg-white/60"
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1.5">
                          {metricValue(p, metric.key)}
                          {isBest && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/15 px-2 py-0.5 text-[10px] font-bold text-[var(--color-success)]">
                              <Check className="h-3 w-3" />
                              Best
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </FragmentRow>
              );
            })}

            {/* action row */}
            <div />
            {chosen.map((p) => (
              <div key={`action-${p.rank}`} className="flex flex-col gap-2">
                <Link
                  href={`/product/${p.rank}`}
                  className="bg-gradient-brand inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] active:scale-95"
                >
                  View details
                </Link>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-soft"
                >
                  Visit
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
