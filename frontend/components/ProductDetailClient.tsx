"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  ExternalLink,
  ArrowLeft,
  Tag,
  Store,
  Truck,
  ShieldCheck,
  MessageSquareText,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Gauge,
  TrendingUp,
  CheckCircle2,
  XCircle,
  PackageCheck,
  PackageX,
  Heart,
} from "lucide-react";
import type { CompareResult } from "@/lib/types";
import { getLastResult } from "@/lib/storage";
import {
  formatPrice,
  getSentiment,
  getConfidence,
  getPros,
  getCons,
  productId,
  detectStore,
} from "@/lib/derive";
import {
  getFavoriteId,
  isFavorited,
  saveFavoriteToLocalStorage,
} from "@/lib/favorites";
import StarRating from "./StarRating";
import StoreBadge from "./StoreBadge";

export default function ProductDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<CompareResult | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setData(getLastResult());
    setLoaded(true);
  }, []);

  const product = data?.results.find((p) => String(p.rank) === id) ?? null;
  const nextBest =
    data?.results.find((p) => p.rank === (product?.rank ?? 0) + 1) ??
    data?.results.find((p) => p.rank !== product?.rank) ??
    null;
  const similar = data?.results.filter((p) => p.rank !== product?.rank) ?? [];

  useEffect(() => {
    if (!product) return;
    setFavorited(isFavorited(getFavoriteId(product)));
  }, [product]);

  const toggleFavorite = () => {
    if (!product) return;
    const added = saveFavoriteToLocalStorage(product);
    setFavorited(added);
    setToast(added ? "Added to Favorites!" : "Removed from Favorites");
    window.setTimeout(() => setToast(null), 2000);
  };

  if (!loaded) {
    return <div className="py-32" />;
  }

  if (!product) {
    return (
      <main className="mx-auto max-w-lg px-5 py-24 text-center">
        <div className="card-base p-8">
          <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)]">
            <Package className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold">Product not available</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            We couldn&apos;t find this product. Run a new comparison to view full
            analysis.
          </p>
          <Link
            href="/"
            className="bg-gradient-brand mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white shadow-soft"
          >
            Start a search
          </Link>
        </div>
      </main>
    );
  }

  const sentiment = getSentiment(product);
  const confidence = getConfidence(product);
  const pros = getPros(product);
  const cons = getCons(product);
  const isTop = product.rank === 1;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-8 pb-16">
      <Link
        href="/results"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to results
      </Link>

      {/* Overview */}
      <section className="card-base relative overflow-hidden p-6 sm:p-8">
        {isTop && <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1.5" />}
        <div className="bg-gradient-brand-soft absolute -right-20 -top-20 h-56 w-56 rounded-full blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row">
          <div className="relative h-40 w-40 flex-shrink-0 self-center overflow-hidden rounded-3xl bg-white shadow-soft sm:self-start">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.title}
                fill
                sizes="160px"
                className="object-contain p-3"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Package className="h-12 w-12 text-[var(--color-border)]" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StoreBadge url={product.url} source={product.source} />
              {isTop && (
                <span className="bg-gradient-brand inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white">
                  <Sparkles className="h-3 w-3" />
                  AI Top Pick
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  product.in_stock
                    ? "bg-[var(--color-success)]/12 text-[var(--color-success)]"
                    : "bg-red-50 text-red-500"
                }`}
              >
                {product.in_stock ? (
                  <PackageCheck className="h-3.5 w-3.5" />
                ) : (
                  <PackageX className="h-3.5 w-3.5" />
                )}
                {product.in_stock ? "In stock" : "Out of stock"}
              </span>
            </div>

            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <StarRating stars={product.stars} size={18} />
              {(product.reviews_count ?? 0) > 0 && (
                <span className="text-sm text-[var(--color-muted)]">
                  {(product.reviews_count ?? 0).toLocaleString()} verified reviews
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <span className="bg-gradient-brand bg-clip-text text-4xl font-extrabold text-transparent">
                {formatPrice(product)}
              </span>
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gradient-brand inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] hover:shadow-lift active:scale-95"
              >
                Buy at {detectStore(product.url, product.source)}
                <ExternalLink className="h-4 w-4" />
              </a>
              <div className="relative">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  title={
                    favorited ? "Remove from Favorites" : "Add to Favorites"
                  }
                  aria-label={
                    favorited ? "Remove from Favorites" : "Add to Favorites"
                  }
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white/80 text-[#E91E63] shadow-soft transition-all hover:-translate-y-0.5 hover:bg-white"
                >
                  <Heart
                    className="h-5 w-5"
                    fill={favorited ? "currentColor" : "none"}
                  />
                </button>
                {toast && (
                  <span className="animate-fade-in absolute left-0 top-14 z-10 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-lift">
                    {toast}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Review Analysis + Sentiment */}
          <Panel icon={MessageSquareText} title="Review analysis">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-white/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  Overall rating
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">
                    {product.stars?.toFixed(1) ?? "—"}
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">/ 5.0</span>
                </div>
                <div className="mt-2">
                  <StarRating stars={product.stars} showValue={false} />
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-white/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
                  Review volume
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold">
                    {(product.reviews_count ?? 0).toLocaleString()}
                  </span>
                  <span className="text-sm text-[var(--color-muted)]">reviews</span>
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Quality score {product.quality_score.toFixed(1)}
                </p>
              </div>
            </div>

            {/* Sentiment breakdown */}
            <div className="mt-5">
              <p className="mb-3 text-sm font-bold">Sentiment breakdown</p>
              <div className="space-y-3">
                <SentimentBar
                  label="Positive"
                  value={sentiment.positive}
                  color="var(--color-success)"
                />
                <SentimentBar
                  label="Neutral"
                  value={sentiment.neutral}
                  color="#8DA2FF"
                />
                <SentimentBar
                  label="Negative"
                  value={sentiment.negative}
                  color="#FF8FA3"
                />
              </div>
              <p className="mt-3 text-xs text-[var(--color-muted)]">
                Sentiment is derived from aggregate rating signals.
              </p>
            </div>
          </Panel>

          {/* Pros & Cons */}
          <Panel icon={ThumbsUp} title="Pros & cons">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--color-success)]">
                  <ThumbsUp className="h-4 w-4" />
                  Pros
                </div>
                <div className="space-y-2">
                  {pros.map((p) => (
                    <div
                      key={p}
                      className="flex items-start gap-2 rounded-2xl border border-[var(--color-success)]/25 bg-[var(--color-success)]/8 p-3 text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-success)]" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[#E5547A]">
                  <ThumbsDown className="h-4 w-4" />
                  Cons
                </div>
                <div className="space-y-2">
                  {cons.map((c) => (
                    <div
                      key={c}
                      className="flex items-start gap-2 rounded-2xl border border-[#FFB7D5]/50 bg-[#FFB7D5]/15 p-3 text-sm"
                    >
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E5547A]" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* AI Insights */}
          <Panel icon={Sparkles} title="AI insights">
            <div className="bg-gradient-brand-soft rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--color-primary)]">
                <Sparkles className="h-4 w-4" />
                Why this was selected
              </div>
              <p className="text-sm leading-relaxed">
                {isTop && data?.justification
                  ? data.justification
                  : `${product.title} ranks #${product.rank} for this search, balancing price (${formatPrice(
                      product
                    )}), ratings, and availability against the other options.`}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-border)] bg-white/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <TrendingUp className="h-4 w-4 text-[var(--color-primary)]" />
                  vs. next best
                </div>
                {nextBest ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    Compared to{" "}
                    <span className="font-semibold text-[var(--color-text)]">
                      {detectStore(nextBest.url, nextBest.source)}
                    </span>{" "}
                    at {formatPrice(nextBest)}
                    {product.price !== null && nextBest.price !== null
                      ? product.price <= nextBest.price
                        ? ` — you save ${product.currency || "$"}${(
                            nextBest.price - product.price
                          ).toFixed(2)}.`
                        : ` — ${product.currency || "$"}${(
                            product.price - nextBest.price
                          ).toFixed(2)} more, justified by ratings.`
                      : "."}
                  </p>
                ) : (
                  <p className="text-sm text-[var(--color-muted)]">
                    No close alternative to compare against.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-white/60 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <Gauge className="h-4 w-4 text-[var(--color-primary)]" />
                  Confidence score
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-extrabold text-[var(--color-primary)]">
                    {confidence}%
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-primary)]/10">
                    <div
                      className="bg-gradient-brand h-full rounded-full"
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right column: Price + Retailer */}
        <div className="space-y-6">
          <Panel icon={Tag} title="Price information">
            <InfoRow label="Current price" value={formatPrice(product)} strong />
            <InfoRow label="Currency" value={product.currency || "USD"} />
            <InfoRow
              label="Availability"
              value={product.in_stock ? "In stock" : "Out of stock"}
            />
            {nextBest && nextBest.price !== null && (
              <InfoRow
                label="Next best price"
                value={formatPrice(nextBest)}
              />
            )}
          </Panel>

          <Panel icon={Store} title="Retailer information">
            <InfoRow
              label="Retailer"
              value={detectStore(product.url, product.source)}
            />
            <InfoRow
              label="Delivery"
              value={product.delivery || "Standard shipping"}
              icon={Truck}
            />
            <InfoRow
              label="Warranty"
              value={product.warranty || "Not listed"}
              icon={ShieldCheck}
            />
            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:shadow-soft"
            >
              Open listing
              <ExternalLink className="h-4 w-4" />
            </a>
          </Panel>
        </div>
      </div>

      {/* Similar products */}
      {similar.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-4 text-xl font-bold tracking-tight">
            Similar products
          </h2>
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 pb-2">
            {similar.map((p) => (
              <Link
                key={p.url + p.rank}
                href={`/product/${productId(p)}`}
                className="card-base group w-64 flex-shrink-0 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="relative mb-3 flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl bg-white">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={p.title}
                      fill
                      sizes="256px"
                      className="object-contain p-3"
                      unoptimized
                    />
                  ) : (
                    <Package className="h-10 w-10 text-[var(--color-border)]" />
                  )}
                </div>
                <StoreBadge url={p.url} source={p.source} />
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-[var(--color-primary)]">
                  {p.title}
                </h3>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold">{formatPrice(p)}</span>
                  <StarRating stars={p.stars} size={13} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Panel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Tag;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-base p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="bg-gradient-brand-soft flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-primary)]">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SentimentBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs font-medium">
        <span>{label}</span>
        <span className="text-[var(--color-muted)]">{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-primary)]/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  strong,
  icon: Icon,
}: {
  label: string;
  value: string;
  strong?: boolean;
  icon?: typeof Truck;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        {Icon && <Icon className="h-4 w-4" />}
        {label}
      </span>
      <span
        className={`text-right text-sm ${
          strong ? "text-lg font-extrabold text-[var(--color-primary)]" : "font-semibold"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
