"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Truck, ShieldCheck, Package, ArrowRight, Heart } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice, productId } from "@/lib/derive";
import {
  getFavoriteId,
  isFavorited,
  saveFavoriteToLocalStorage,
} from "@/lib/favorites";
import StarRating from "./StarRating";
import StoreBadge from "./StoreBadge";

export default function AlternativeCard({
  product,
  budget,
}: {
  product: Product;
  budget?: number | null;
}) {
  const favoriteId = getFavoriteId(product);
  const [favorited, setFavorited] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const withinBudget =
    typeof budget === "number" &&
    Number.isFinite(budget) &&
    product.price !== null &&
    product.price <= budget;

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
    <div className="card-base group flex gap-4 p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-soft">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            sizes="80px"
            className="object-contain p-1.5"
            unoptimized
          />
        ) : (
          <Package className="h-7 w-7 text-[var(--color-border)]" />
        )}
        <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[10px] font-bold text-[var(--color-primary)] shadow-soft">
          {product.rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <StoreBadge url={product.url} source={product.source} />
          <div className="relative flex items-center gap-2">
            <span className="text-lg font-bold">{formatPrice(product)}</span>
            <button
              type="button"
              onClick={toggleFavorite}
              title={favorited ? "Remove from Favorites" : "Add to Favorites"}
              aria-label={
                favorited ? "Remove from Favorites" : "Add to Favorites"
              }
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/80 text-[#E91E63] transition-all hover:bg-white hover:shadow-soft"
            >
              <Heart
                className="h-4 w-4"
                fill={favorited ? "currentColor" : "none"}
              />
            </button>
            {toast && (
              <span className="animate-fade-in absolute right-0 top-9 z-10 whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] shadow-lift">
                {toast}
              </span>
            )}
          </div>
        </div>
        {withinBudget && (
          <span className="mb-1.5 inline-flex rounded-full bg-[var(--color-success)]/12 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-success)]">
            Within budget
          </span>
        )}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors group-hover:text-[var(--color-primary)]">
          {product.title}
        </h3>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
          <StarRating stars={product.stars} size={13} />
          {product.delivery && (
            <span className="inline-flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              {product.delivery}
            </span>
          )}
          {product.warranty && (
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {product.warranty}
            </span>
          )}
        </div>

        <Link
          href={`/product/${productId(product)}`}
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)] transition-all hover:gap-2"
        >
          View details
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
