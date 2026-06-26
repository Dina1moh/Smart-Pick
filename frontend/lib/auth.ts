"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TOKEN_KEY = "smartpick_token";
const USER_KEY = "smartpick_user";
export const AUTH_EVENT = "smartpick:auth";

export interface AuthUser {
  id: number;
  name?: string | null;
  email: string;
}

interface AuthResponse {
  token: string;
  user: AuthUser;
}

/* -------- storage helpers -------- */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Notify same-tab listeners (storage event only fires across tabs).
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/* -------- network helpers -------- */
async function postJson(path: string, body: unknown): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail =
      (data && (data.detail as string)) || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return data as AuthResponse;
}

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<AuthUser> {
  const { token, user } = await postJson("signup", { name, email, password });
  persistSession(token, user);
  return user;
}

export async function login(
  email: string,
  password: string
): Promise<AuthUser> {
  const { token, user } = await postJson("login", { email, password });
  persistSession(token, user);
  return user;
}

export async function logout(): Promise<void> {
  const token = getToken();
  clearSession();
  if (!token) return;
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* best-effort: session is already cleared locally */
  }
}
