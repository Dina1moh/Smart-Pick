import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-[var(--color-border)] bg-white/40 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="bg-gradient-brand flex h-8 w-8 items-center justify-center rounded-lg">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-sm font-bold tracking-tight">
            Smart<span className="text-gradient">Pick</span>
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm text-[var(--color-muted)]">
          <Link href="/" className="transition-colors hover:text-[var(--color-primary)]">
            Home
          </Link>
          <Link
            href="/compare"
            className="transition-colors hover:text-[var(--color-primary)]"
          >
            Compare
          </Link>
          <Link
            href="/history"
            className="transition-colors hover:text-[var(--color-primary)]"
          >
            History
          </Link>
          <Link
            href="/about"
            className="transition-colors hover:text-[var(--color-primary)]"
          >
            About
          </Link>
        </nav>
        <p className="text-xs text-[var(--color-muted)]">
          © {new Date().getFullYear()} SmartPick · AI multi-agent comparison
        </p>
      </div>
    </footer>
  );
}
