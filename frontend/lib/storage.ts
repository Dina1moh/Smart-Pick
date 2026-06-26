"use client";

import type { CompareResult } from "./types";

const RECENT_KEY = "smartpick_recent";
const HISTORY_KEY = "smartpick_history";
const RESULT_KEY = "smartpick_last_result";

export interface RecentSearch {
  product: string;
  priority: string;
}

export interface HistoryEntry {
  id: string;
  product: string;
  priority: string;
  date: number;
  category?: string | null;
  totalFound?: number;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

/* -------- Recent searches (home pills) -------- */
export function getRecentSearches(): RecentSearch[] {
  return read<RecentSearch[]>(RECENT_KEY, []);
}

export function addRecentSearch(product: string, priority: string) {
  const trimmed = product.trim();
  if (!trimmed) return;
  const existing = getRecentSearches().filter(
    (s) => s.product.toLowerCase() !== trimmed.toLowerCase()
  );
  const next = [{ product: trimmed, priority }, ...existing].slice(0, 5);
  write(RECENT_KEY, next);
}

/* -------- Full history (history page) -------- */
export function getHistory(): HistoryEntry[] {
  return read<HistoryEntry[]>(HISTORY_KEY, []);
}

export function addHistoryEntry(entry: Omit<HistoryEntry, "id" | "date">) {
  const item: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: Date.now(),
  };
  const next = [item, ...getHistory()].slice(0, 50);
  write(HISTORY_KEY, next);
}

export function removeHistoryEntry(id: string) {
  write(
    HISTORY_KEY,
    getHistory().filter((e) => e.id !== id)
  );
}

export function clearHistory() {
  write(HISTORY_KEY, []);
}

/* -------- Last result cache (results -> product/compare) -------- */
export function saveLastResult(result: CompareResult) {
  write(RESULT_KEY, result);
}

export function getLastResult(): CompareResult | null {
  return read<CompareResult | null>(RESULT_KEY, null);
}
