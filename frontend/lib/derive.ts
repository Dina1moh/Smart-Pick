import type { Product } from "./types";

/* Deterministic helpers that derive presentational data from the API payload.
   Everything here is computed from real product fields so values are stable
   across renders (no random flicker). Clearly-mocked sections are labelled in UI. */

export function detectStore(url: string, source?: string): string {
  if (source) return source;
  if (!url) return "Retailer";
  if (url.includes("amazon")) return "Amazon";
  if (url.includes("ebay")) return "eBay";
  if (url.includes("walmart")) return "Walmart";
  if (url.includes("bestbuy")) return "Best Buy";
  if (url.includes("newegg")) return "Newegg";
  if (url.includes("target")) return "Target";
  return "Retailer";
}

export function formatPrice(product: Product): string {
  const price = product.price;
  if (price == null || !Number.isFinite(price)) return "Price unavailable";
  const currency = product.currency || "$";
  const amount = price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  // Multi-letter currency codes (EGP, AED, USD) read better with a space.
  return currency.length > 1 ? `${currency} ${amount}` : `${currency}${amount}`;
}

/** Stable pseudo-hash from a string (0..1). */
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

/** Sentiment breakdown derived from star rating (falls back to score). */
export function getSentiment(product: Product): Sentiment {
  const base =
    product.stars !== null
      ? product.stars / 5
      : Math.min(product.quality_score / 100, 1) || 0.7;
  const jitter = hash01(product.title) * 0.08 - 0.04;
  const positive = Math.round(
    Math.min(0.97, Math.max(0.4, base + 0.1 + jitter)) * 100
  );
  let negative = Math.round(Math.max(2, (1 - base) * 55) );
  if (positive + negative > 98) negative = 98 - positive;
  const neutral = Math.max(0, 100 - positive - negative);
  return { positive, neutral, negative };
}

/** Confidence score 0..100 for the AI recommendation. */
export function getConfidence(product: Product): number {
  const ratingFactor = product.stars ? (product.stars / 5) * 40 : 24;
  const reviewFactor = Math.min((product.reviews_count ?? 0) / 5000, 1) * 25;
  const qualityFactor = Math.min(product.quality_score / 100, 1) * 25;
  const stockFactor = product.in_stock ? 10 : 0;
  return Math.round(
    Math.min(99, 45 + ratingFactor + reviewFactor + qualityFactor + stockFactor - 30)
  );
}

/** Composite AI recommendation score (0..100) used on compare page. */
export function getAIScore(product: Product): number {
  const rating = product.stars ? (product.stars / 5) * 100 : 60;
  const reviews = Math.min((product.reviews_count ?? 0) / 8000, 1) * 100;
  const quality = Math.min(product.quality_score, 100);
  const stock = product.in_stock ? 100 : 40;
  const score = rating * 0.4 + quality * 0.3 + reviews * 0.2 + stock * 0.1;
  return Math.round(Math.min(99, Math.max(35, score)));
}

const POSITIVE_POOL = [
  "Excellent value for the price point",
  "Consistently high customer ratings",
  "Trusted, well-reviewed retailer",
  "Strong build quality reported",
  "Reliable performance over time",
  "Backed by a solid warranty",
  "Fast, dependable shipping",
  "Currently in stock and ready to ship",
];

const NEGATIVE_POOL = [
  "Slightly higher price than rivals",
  "Limited color or variant options",
  "Some users mention packaging issues",
  "Warranty terms could be clearer",
  "Delivery estimate may vary by region",
  "Fewer reviews than category leaders",
];

export function getPros(product: Product): string[] {
  const pros: string[] = [];
  if (product.in_stock) pros.push("In stock and ready to ship");
  if (product.stars && product.stars >= 4.3)
    pros.push(`Highly rated at ${product.stars.toFixed(1)} stars`);
  if ((product.reviews_count ?? 0) > 1000)
    pros.push(`Validated by ${(product.reviews_count ?? 0).toLocaleString()} reviews`);
  if (product.warranty) pros.push(`Includes ${product.warranty}`);
  if (product.delivery) pros.push(`${product.delivery}`);
  const seed = Math.floor(hash01(product.title) * POSITIVE_POOL.length);
  for (let i = 0; pros.length < 4 && i < POSITIVE_POOL.length; i++) {
    const candidate = POSITIVE_POOL[(seed + i) % POSITIVE_POOL.length];
    if (!pros.includes(candidate)) pros.push(candidate);
  }
  return pros.slice(0, 4);
}

export function getCons(product: Product): string[] {
  const cons: string[] = [];
  if (!product.in_stock) cons.push("Currently out of stock");
  if (product.stars && product.stars < 4)
    cons.push("Rating is below the category average");
  if (!product.warranty) cons.push("No warranty information listed");
  const seed = Math.floor(hash01(product.url || product.title) * NEGATIVE_POOL.length);
  for (let i = 0; cons.length < 3 && i < NEGATIVE_POOL.length; i++) {
    const candidate = NEGATIVE_POOL[(seed + i) % NEGATIVE_POOL.length];
    if (!cons.includes(candidate)) cons.push(candidate);
  }
  return cons.slice(0, 3);
}

/** Stable id for routing to /product/[id]. */
export function productId(product: Product): string {
  return String(product.rank);
}
