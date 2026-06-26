import Link from "next/link";
import {
  Search,
  MessageSquareText,
  Trophy,
  ArrowRight,
  Sparkles,
  Zap,
  ShieldCheck,
  Eye,
  Scale,
  Clock,
} from "lucide-react";

const AGENTS = [
  {
    icon: Search,
    name: "Search Agent",
    desc: "Scans major retailers in real time and gathers live listings, prices, and availability.",
    color: "#7C6CFF",
  },
  {
    icon: MessageSquareText,
    name: "Review Agent",
    desc: "Reads thousands of customer reviews and scores sentiment, quality, and reliability.",
    color: "#72DDF7",
  },
  {
    icon: Trophy,
    name: "Ranking Agent",
    desc: "Weighs everything against your chosen priority and recommends the single best option.",
    color: "#53C89B",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Decisions in seconds",
    desc: "No more 30 open tabs. One search returns a clear, ranked recommendation.",
  },
  {
    icon: Scale,
    title: "Priority-driven",
    desc: "Optimize for price, ratings, warranty, or delivery speed — your call.",
  },
  {
    icon: Eye,
    title: "Transparent reasoning",
    desc: "Every pick comes with a plain-language explanation of why it won.",
  },
  {
    icon: ShieldCheck,
    title: "Trust signals built in",
    desc: "Ratings, review volume, and sentiment combine into a confidence score.",
  },
  {
    icon: Clock,
    title: "Always up to date",
    desc: "Live retailer data means prices and stock reflect the current moment.",
  },
  {
    icon: Sparkles,
    title: "Multi-agent intelligence",
    desc: "Specialized AI agents collaborate the way an expert shopper would.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 pt-16 pb-16">
      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center">
        <div className="bg-gradient-brand-soft mx-auto mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium text-[var(--color-primary)]">
          <Sparkles className="h-4 w-4" />
          About SmartPick
        </div>
        <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
          The smartest way to{" "}
          <span className="text-gradient">choose what to buy</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
          SmartPick is an AI-powered product comparison engine. Instead of making
          you read endless reviews and compare prices across sites, a team of AI
          agents does the heavy lifting and hands you a confident decision.
        </p>
      </section>

      {/* Agent workflow */}
      <section className="mt-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            How the AI agents work
          </h2>
          <p className="mt-2 text-[var(--color-muted)]">
            Three specialized agents, one seamless pipeline.
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          {AGENTS.map((agent, i) => {
            const Icon = agent.icon;
            return (
              <div key={agent.name} className="flex flex-1 items-center gap-4">
                <div className="card-base group relative flex-1 overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift">
                  <div
                    className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-25"
                    style={{ background: agent.color }}
                  />
                  <div className="relative">
                    <span
                      className="animate-float-y flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-soft"
                      style={{ background: agent.color }}
                    >
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted)]">
                        Step {i + 1}
                      </span>
                    </div>
                    <h3 className="mt-1 text-xl font-bold">{agent.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      {agent.desc}
                    </p>
                  </div>
                </div>

                {i < AGENTS.length - 1 && (
                  <div className="flex flex-shrink-0 items-center justify-center">
                    {/* horizontal connector on desktop */}
                    <svg
                      className="hidden h-6 w-10 text-[var(--color-primary)] lg:block"
                      viewBox="0 0 40 24"
                      fill="none"
                    >
                      <line
                        x1="2"
                        y1="12"
                        x2="30"
                        y2="12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="animate-dash-flow"
                      />
                      <path
                        d="M28 6l8 6-8 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {/* vertical connector on mobile */}
                    <ArrowRight className="h-6 w-6 rotate-90 text-[var(--color-primary)] lg:hidden" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Features */}
      <section className="mt-24">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight">
            Why people choose SmartPick
          </h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="card-base group p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
              >
                <span className="bg-gradient-brand-soft flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--color-primary)] transition-transform group-hover:scale-110">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-24">
        <div className="card-base relative overflow-hidden p-10 text-center">
          <div className="bg-gradient-brand-soft absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight">
              Ready to stop comparing?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[var(--color-muted)]">
              Let the AI agents find your best option in seconds.
            </p>
            <Link
              href="/"
              className="bg-gradient-brand mt-6 inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.03] hover:shadow-lift active:scale-95"
            >
              Start deciding
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
