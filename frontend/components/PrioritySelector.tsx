"use client";

import { Check } from "lucide-react";
import { PRIORITIES } from "@/lib/priorities";

interface Props {
  value: string;
  onChange: (id: string) => void;
  variant?: "cards" | "segmented";
}

export default function PrioritySelector({
  value,
  onChange,
  variant = "cards",
}: Props) {
  if (variant === "segmented") {
    return (
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {PRIORITIES.map((p) => {
          const Icon = p.icon;
          const active = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.id)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                active
                  ? "border-transparent bg-gradient-brand text-white shadow-soft"
                  : "border-[var(--color-border)] bg-white/70 text-[var(--color-muted)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]"
              }`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {p.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {PRIORITIES.map((p) => {
        const Icon = p.icon;
        const active = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            style={
              active
                ? {
                    borderColor: p.accent,
                    boxShadow: `0 0 0 1px ${p.accent}, 0 16px 40px -18px ${p.accent}`,
                  }
                : undefined
            }
            className={`group relative flex flex-col items-start gap-3 rounded-3xl border bg-white/80 p-5 text-left transition-all duration-300 ${
              active
                ? "scale-[1.02]"
                : "border-[var(--color-border)] hover:-translate-y-1 hover:shadow-card"
            }`}
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
              style={{
                background: active ? p.accent : "rgba(124,108,255,0.08)",
                color: active ? "#fff" : p.accent,
              }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.1} />
            </span>
            <span className="text-sm font-bold text-[var(--color-text)]">
              {p.label}
            </span>
            <span className="text-xs leading-relaxed text-[var(--color-muted)]">
              {p.description}
            </span>
            {active && (
              <span
                className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full text-white"
                style={{ background: p.accent }}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
