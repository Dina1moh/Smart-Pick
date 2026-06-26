"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Menu, X, LogOut, Heart } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { logout } from "@/lib/auth";
import {
  FAVORITES_EVENT,
  loadFavoritesFromLocalStorage,
} from "@/lib/favorites";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/compare", label: "Compare" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
];

function initialOf(user: { name?: string | null; email: string }): string {
  const base = user.name?.trim() || user.email;
  return base.charAt(0).toUpperCase();
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const syncFavorites = () =>
      setFavoriteCount(loadFavoritesFromLocalStorage().length);
    syncFavorites();
    window.addEventListener(FAVORITES_EVENT, syncFavorites);
    window.addEventListener("storage", syncFavorites);
    return () => {
      window.removeEventListener(FAVORITES_EVENT, syncFavorites);
      window.removeEventListener("storage", syncFavorites);
    };
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleLogout = async () => {
    setMenuOpen(false);
    setOpen(false);
    await logout();
    router.push("/");
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-strong shadow-soft border-b border-white/60"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-xl shadow-soft transition-transform group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Smart<span className="text-gradient">Pick</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "text-[var(--color-primary)]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {link.label}
              {isActive(link.href) && (
                <span className="bg-gradient-brand absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full" />
              )}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/favorites"
            title="Favorites"
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-all hover:shadow-soft ${
              isActive("/favorites")
                ? "border-transparent bg-gradient-brand text-white"
                : "border-[var(--color-border)] bg-white/70 text-[var(--color-text)]"
            }`}
          >
            <Heart
              className="h-4 w-4"
              fill={favoriteCount > 0 ? "currentColor" : "none"}
            />
            <span>({favoriteCount})</span>
          </Link>
          {loading ? null : user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/70 py-1 pl-1 pr-3 text-sm font-medium transition-all hover:shadow-soft"
                aria-label="Account menu"
              >
                <span className="bg-gradient-brand flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white">
                  {initialOf(user)}
                </span>
                <span className="max-w-[140px] truncate">
                  {user.name?.trim() || user.email}
                </span>
              </button>
              {menuOpen && (
                <div className="glass-strong animate-fade-in absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-white/60 p-1.5 shadow-lift">
                  <div className="border-b border-[var(--color-border)] px-3 py-2">
                    <p className="truncate text-sm font-semibold">
                      {user.name?.trim() || "Signed in"}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {user.email}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-white/70"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:text-[var(--color-primary)]"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="bg-gradient-brand rounded-full px-5 py-2 text-sm font-semibold text-white shadow-soft transition-all hover:scale-[1.03] hover:shadow-lift active:scale-95"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl p-2 text-[var(--color-text)] transition-colors hover:bg-white/60 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="glass-strong animate-fade-in border-t border-white/60 px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-gradient-brand-soft text-[var(--color-primary)]"
                    : "text-[var(--color-muted)] hover:bg-white/60"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <Link
              href="/favorites"
              className={`mt-2 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                isActive("/favorites")
                  ? "border-transparent bg-gradient-brand text-white"
                  : "border-[var(--color-border)] bg-white/70 text-[var(--color-text)]"
              }`}
            >
              <Heart
                className="h-4 w-4"
                fill={favoriteCount > 0 ? "currentColor" : "none"}
              />
              Favorites ({favoriteCount})
            </Link>

            {loading ? null : user ? (
              <div className="mt-2 border-t border-[var(--color-border)] pt-3">
                <div className="flex items-center gap-2 px-4 py-1">
                  <span className="bg-gradient-brand flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
                    {initialOf(user)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {user.name?.trim() || "Signed in"}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <Link
                  href="/login"
                  className="flex-1 rounded-full border border-[var(--color-border)] px-4 py-2 text-center text-sm font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="bg-gradient-brand flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold text-white shadow-soft"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
