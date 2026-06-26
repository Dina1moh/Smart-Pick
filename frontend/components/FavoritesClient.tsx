"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ExternalLink,
  Heart,
  Package,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import {
  clearAllFavorites,
  FAVORITES_EVENT,
  loadFavoritesFromLocalStorage,
  removeFavoriteFromLocalStorage,
  type FavoriteProduct,
} from "@/lib/favorites";
import { detectStore } from "@/lib/derive";
import StoreBadge from "./StoreBadge";

function formatFavoritePrice(product: FavoriteProduct): string {
  if (product.price === null || !Number.isFinite(product.price)) {
    return "Price unavailable";
  }
  const amount = product.price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return product.currency.length > 1
    ? `${product.currency} ${amount}`
    : `${product.currency}${amount}`;
}

export default function FavoritesClient() {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => {
    setFavorites(loadFavoritesFromLocalStorage());
    setLoaded(true);
  };

  useEffect(() => {
    refresh();
    window.addEventListener(FAVORITES_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const remove = (id: string) => {
    removeFavoriteFromLocalStorage(id);
    setToast("Removed from Favorites");
    window.setTimeout(() => setToast(null), 2000);
  };

  const clear = () => {
    clearAllFavorites();
    setToast("Favorites cleared");
    window.setTimeout(() => setToast(null), 2000);
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-10 pb-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Heart className="h-6 w-6 text-[#E91E63]" fill="currentColor" />
            <h1 className="text-3xl font-extrabold tracking-tight">
              Favorites
            </h1>
          </div>
          <p className="text-[var(--color-muted)]">
            Products you saved for later comparison.
          </p>
        </div>
        {favorites.length > 0 && (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[#E5547A] transition-all hover:-translate-y-0.5 hover:shadow-soft"
          >
            <Trash2 className="h-4 w-4" />
            Clear All Favorites
          </button>
        )}
      </div>

      {toast && (
        <div className="animate-fade-in mb-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--color-text)] shadow-soft">
          {toast}
        </div>
      )}

      {loaded && favorites.length === 0 ? (
        <div className="card-base p-10 text-center">
          <div className="bg-gradient-brand-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[#E91E63]">
            <Heart className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold">No favorites yet</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Search and add products!
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((product) => (
            <article
              key={product.id}
              className="card-base group flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative flex aspect-[4/3] items-center justify-center bg-white">
                {product.image ? (
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-contain p-5"
                    unoptimized
                  />
                ) : (
                  <Package className="h-12 w-12 text-[var(--color-border)]" />
                )}
                <button
                  type="button"
                  onClick={() => remove(product.id)}
                  title="Remove from Favorites"
                  aria-label="Remove from Favorites"
                  className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-white/90 text-[#E91E63] shadow-soft transition-all hover:scale-105"
                >
                  <Heart className="h-5 w-5" fill="currentColor" />
                </button>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <StoreBadge url={product.url} source={product.source} />
                  <span className="text-lg font-extrabold">
                    {formatFavoritePrice(product)}
                  </span>
                </div>
                <h2 className="line-clamp-2 text-base font-bold leading-snug transition-colors group-hover:text-[var(--color-primary)]">
                  {product.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--color-muted)]">
                  {product.stars !== null && product.stars !== undefined ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-[#FFB400] text-[#FFB400]" />
                      {product.stars.toFixed(1)}
                    </span>
                  ) : (
                    <span>No rating</span>
                  )}
                  {(product.reviews_count ?? 0) > 0 && (
                    <span>
                      {(product.reviews_count ?? 0).toLocaleString()} reviews
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted)]">
                  Saved from {detectStore(product.url, product.source)}
                </p>
                <a
                  href={product.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-brand mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.02] active:scale-95"
                >
                  Go to Retailer
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
