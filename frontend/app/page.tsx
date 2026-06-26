import { Sparkles, Search, Brain, Trophy } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import RecentSearches from "@/components/RecentSearches";
import DiscoverSections from "@/components/DiscoverSections";

const STEPS = [
  { icon: Search, label: "Search retailers" },
  { icon: Brain, label: "Analyze reviews" },
  { icon: Trophy, label: "Recommend the best" },
];

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-16 pb-4 text-center sm:pt-24">
        <div className="animate-fade-up mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/70 px-4 py-1.5 text-sm font-medium text-[var(--color-muted)] backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-[var(--color-primary)]" />
          AI multi-agent product intelligence
        </div>

        <h1 className="animate-fade-up mx-auto max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Stop Comparing.
          <br />
          <span className="text-gradient">Start Deciding.</span>
        </h1>

        <p className="animate-fade-up mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
          AI searches retailers, analyzes reviews, and recommends the best option
          for you.
        </p>

        <div className="animate-fade-up mt-10">
          <SearchBar size="lg" showPriorities prioritiesVariant="cards" />
        </div>

        <RecentSearches />

        {/* mini pipeline hint */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-[var(--color-muted)]">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2">
                <span className="bg-gradient-brand-soft flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-primary)]">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{s.label}</span>
                {i < STEPS.length - 1 && (
                  <span className="ml-3 hidden h-px w-8 bg-[var(--color-border)] sm:block" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <DiscoverSections />
    </main>
  );
}
