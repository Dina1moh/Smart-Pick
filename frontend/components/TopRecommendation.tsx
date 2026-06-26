"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Truck,
  ShieldCheck,
  Smile,
  ExternalLink,
  ArrowRight,
  Package,
  Heart,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice, getSentiment, productId } from "@/lib/derive";
import {
  getFavoriteId,
  isFavorited,
  saveFavoriteToLocalStorage,
} from "@/lib/favorites";
import StarRating from "./StarRating";
import StoreBadge from "./StoreBadge";

interface Props {
  product: Product;
  justification: string;
  budget?: number | null;
}

export default function TopRecommendation({
  product,
  justification,
  budget,
}: Props) {
  const favoriteId = getFavoriteId(product);
  const [favorited, setFavorited] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const sentiment = getSentiment(product);
  const withinBudget =
    typeof budget === "number" &&
    Number.isFinite(budget) &&
    product.price !== null &&
    product.price <= budget;
  const explanation =
    justification ||
    `Based on your priority, ${product.title} offers the strongest balance of price, ratings, and reliability among the options we found.`;

  useEffect(() => {
    setFavorited(isFavorited(favoriteId));
  }, [favoriteId]);

  const toggleFavorite = () => {
    const added = saveFavoriteToLocalStorage(product);
    setFavorited(added);
    setToast(added ? "Added to Favorites!" : "Removed from Favorites");
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="card-base relative overflow-hidden p-6 sm:p-7">
      <div className="bg-gradient-brand absolute inset-x-0 top-0 h-1.5" />
      <div className="bg-gradient-brand-soft absolute -right-16 -top-16 h-48 w-48 rounded-full blur-2xl" />

      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-brand px-3 py-1.5 text-xs font-bold text-white shadow-soft">
            <Sparkles className="h-3.5 w-3.5" />
            AI RECOMMENDATION
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={toggleFavorite}
              title={favorited ? "Remove from Favorites" : "Add to Favorites"}
              aria-label={
                favorited ? "Remove from Favorites" : "Add to Favorites"
              }
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/80 text-[#E91E63] shadow-soft transition-all hover:-translate-y-0.5 hover:bg-white"
            >
              <Heart
                className="h-5 w-5"
                fill={favorited ? "currentColor" : "none"}
              />
            </button>
            {toast && (
              <span className="animate-fade-in absolute right-0 top-12 z-10 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-lift">
                {toast}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-5">
          <div className="relative hidden h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-soft sm:flex">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.title}
                fill
                sizes="96px"
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <Package className="h-9 w-9 text-[var(--color-border)]" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <StoreBadge url={product.url} source={product.source} />
              {product.in_stock && (
                <span className="rounded-full bg-[var(--color-success)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
                  In stock
                </span>
              )}
              {withinBudget && (
                <span className="rounded-full bg-[var(--color-success)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
                  Within budget
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold leading-snug">{product.title}</h2>
            <div className="mt-2 flex items-center gap-3">
              <StarRating stars={product.stars} />
              {(product.reviews_count ?? 0) > 0 && (
                <span className="text-sm text-[var(--color-muted)]">
                  {(product.reviews_count ?? 0).toLocaleString()} reviews
                </span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="bg-gradient-brand bg-clip-text text-3xl font-extrabold text-transparent">
              {formatPrice(product)}
            </p>
          </div>
        </div>

        {/* stat row */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat
            icon={Truck}
            label="Delivery"
            value={product.delivery || "Standard"}
          />
          <Stat
            icon={ShieldCheck}
            label="Warranty"
            value={product.warranty || "Not listed"}
          />
          <Stat
            icon={Smile}
            label="Sentiment"
            value={`${sentiment.positive}% positive`}
            highlight
          />
        </div>

        {/* Why AI chose this */}
        <div className="bg-gradient-brand-soft mt-6 rounded-2xl p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
            <h3 className="text-sm font-bold text-[var(--color-primary)]">
              Why AI chose this
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-[var(--color-text)]">
            {explanation}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/product/${productId(product)}`}
            className="bg-gradient-brand flex flex-1 items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] hover:shadow-lift active:scale-95"
          >
            View full analysis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-5 py-3.5 text-sm font-semibold text-[var(--color-text)] transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            Visit retailer
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Truck;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        highlight
          ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/8"
          : "border-[var(--color-border)] bg-white/60"
      }`}
    >
      <Icon
        className={`mb-1.5 h-4 w-4 ${
          highlight ? "text-[var(--color-success)]" : "text-[var(--color-primary)]"
        }`}
      />
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className="truncate text-sm font-bold">{value}</p>
    </div>
  );
}
