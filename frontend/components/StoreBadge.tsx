import { Store } from "lucide-react";
import { detectStore } from "@/lib/derive";

export default function StoreBadge({
  url,
  source,
}: {
  url: string;
  source?: string;
}) {
  const store = detectStore(url, source);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white/70 px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]">
      <Store className="h-3 w-3 text-[var(--color-primary)]" />
      {store}
    </span>
  );
}
