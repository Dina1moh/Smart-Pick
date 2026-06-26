"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Mail, Lock, LogIn, Loader2, AlertCircle } from "lucide-react";
import { login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) return setError("Please enter your email.");
    if (!password) return setError("Please enter your password.");

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="animate-fade-up w-full max-w-md">
        <div className="glass-strong shadow-lift rounded-[var(--radius-card)] border border-white/60 p-8">
          <div className="mb-7 text-center">
            <span className="bg-gradient-brand shadow-soft mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
              <Sparkles className="h-6 w-6 text-white" strokeWidth={2.2} />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Log in to continue making smarter picks.
            </p>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-2xl border border-[var(--color-accent)]/50 bg-[var(--color-accent)]/15 px-4 py-3 text-sm text-[#b3306b]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field
              icon={Mail}
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              autoComplete="email"
              onChange={setEmail}
            />
            <Field
              icon={Lock}
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              autoComplete="current-password"
              onChange={setPassword}
            />

            <button
              type="submit"
              disabled={submitting}
              className="bg-gradient-brand shadow-soft hover:shadow-lift mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Logging in…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Log in
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-muted)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="font-semibold text-[var(--color-primary)] hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function Field({
  icon: Icon,
  label,
  type,
  placeholder,
  value,
  autoComplete,
  onChange,
}: {
  icon: typeof Mail;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  autoComplete?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">
        {label}
      </span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-[var(--color-border)] bg-white/70 py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-[var(--color-muted)]/70 focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/12"
        />
      </div>
    </label>
  );
}
