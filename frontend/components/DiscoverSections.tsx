"use client";

import { useRouter } from "next/navigation";
import {
  TrendingUp,
  ArrowUpRight,
  Laptop,
  Shirt,
  Home as HomeIcon,
  Gamepad2,
  Sparkle,
  type LucideIcon,
} from "lucide-react";

const TRENDING = [
  { name: "PlayStation 5", tag: "Gaming", growth: "+24%" },
  { name: "Nintendo Switch", tag: "Gaming", growth: "+18%" },
  { name: "Dyson Airwrap", tag: "Beauty", growth: "+31%" },
  { name: "Galaxy S25", tag: "Electronics", growth: "+12%" },
];

const CATEGORIES: { name: string; icon: LucideIcon; query: string; color: string }[] =
  [
    { name: "Electronics", icon: Laptop, query: "Wireless headphones", color: "#7C6CFF" },
    { name: "Fashion", icon: Shirt, query: "Running shoes", color: "#FFB7D5" },
    { name: "Home", icon: HomeIcon, query: "Robot vacuum", color: "#53C89B" },
    { name: "Gaming", icon: Gamepad2, query: "PlayStation 5", color: "#72DDF7" },
    { name: "Beauty", icon: Sparkle, query: "Dyson Airwrap", color: "#8DA2FF" },
  ];

export default function DiscoverSections() {
  const router = useRouter();
  const go = (q: string, priority = "best_rating") =>
    router.push(`/results?q=${encodeURIComponent(q)}&priority=${priority}`);

  return (
    <div className="mx-auto mt-24 max-w-6xl space-y-20 px-5">
      {/* Trending */}
      <section>
        <div className="mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--color-primary)]" />
          <h2 className="text-2xl font-bold tracking-tight">Trending searches</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRENDING.map((t) => (
            <button
              key={t.name}
              onClick={() => go(t.name)}
              className="group card-base relative overflow-hidden p-5 text-left transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              <div className="bg-gradient-brand-soft absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded-full bg-[var(--color-success)]/12 px-2.5 py-1 text-xs font-semibold text-[var(--color-success)]">
                    {t.growth}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-[var(--color-muted)] transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]" />
                </div>
                <h3 className="text-lg font-bold">{t.name}</h3>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{t.tag}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Popular categories</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Jump straight into a comparison.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.name}
                onClick={() => go(c.query)}
                className="group card-base flex flex-col items-center gap-3 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
                  style={{ background: `${c.color}1a`, color: c.color }}
                >
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="text-sm font-semibold">{c.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
