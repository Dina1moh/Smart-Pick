"use client";

import { useEffect, useState } from "react";
import { AUTH_EVENT, getStoredUser, type AuthUser } from "./auth";

/**
 * Reactive view of the stored auth session. Updates on login/logout in the
 * current tab (via the custom AUTH_EVENT) and across tabs (storage event).
 * `loading` is true until the first client-side read, to avoid hydration flash.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    setLoading(false);

    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return { user, loading };
}
