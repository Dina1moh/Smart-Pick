"use client";

import type { Product } from "./types";

export const FAVORITES_KEY = "smartpick_favorites";
export const FAVORITES_EVENT = "smartpick:favorites";

export interface FavoriteProduct {
  id: string;
  title: string;
  price: number | null;
  currency: string;
  image: string | null;
  source?: string;
  url: string;
  stars?: number | null;
  reviews_count?: number | null;
  addedAt: string;
}

function favoriteIdFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").split(".")[0] || "store";
    const match =
      parsed.pathname.match(/\/(?:dp|gp\/product)\/([^/?]+)/i) ||
      parsed.pathname.match(/\/([^/?]+)\/?$/);
    return `${host}_${match?.[1] || encodeURIComponent(url)}`;
  } catch {
    return `product_${encodeURIComponent(url)}`;
  }
}

export function getFavoriteId(product: Pick<Product, "url">): string {
  return favoriteIdFromUrl(product.url);
}

export function favoriteFromProduct(product: Product): FavoriteProduct {
  return {
    id: getFavoriteId(product),
    title: product.title,
    price: product.price,
    currency: product.currency,
    image: product.image,
    source: product.source,
    url: product.url,
    stars: product.stars,
    reviews_count: product.reviews_count,
    addedAt: new Date().toISOString(),
  };
}

function emitFavoritesChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FAVORITES_EVENT));
}

export function loadFavoritesFromLocalStorage(): FavoriteProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const data = window.localStorage.getItem(FAVORITES_KEY);
    return data ? (JSON.parse(data) as FavoriteProduct[]) : [];
  } catch (err) {
    console.error("Failed to load favorites:", err);
    return [];
  }
}

export function saveFavoriteToLocalStorage(product: Product): boolean {
  if (typeof window === "undefined") return false;
  try {
    const favorite = favoriteFromProduct(product);
    const favorites = loadFavoritesFromLocalStorage();
    const exists = favorites.some((item) => item.id === favorite.id);
    const updated = exists
      ? favorites.filter((item) => item.id !== favorite.id)
      : [favorite, ...favorites];

    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    emitFavoritesChange();
    return !exists;
  } catch (err) {
    console.error("Failed to save favorite:", err);
    return false;
  }
}

export function isFavorited(productId: string): boolean {
  return loadFavoritesFromLocalStorage().some((item) => item.id === productId);
}

export function removeFavoriteFromLocalStorage(productId: string) {
  if (typeof window === "undefined") return;
  try {
    const updated = loadFavoritesFromLocalStorage().filter(
      (item) => item.id !== productId
    );
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    emitFavoritesChange();
  } catch (err) {
    console.error("Failed to remove favorite:", err);
  }
}

export function clearAllFavorites() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(FAVORITES_KEY);
    emitFavoritesChange();
  } catch (err) {
    console.error("Failed to clear favorites:", err);
  }
}
