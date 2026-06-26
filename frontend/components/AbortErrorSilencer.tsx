"use client";

import { useEffect } from "react";

/**
 * Dev-only guard that prevents expected fetch aborts (e.g. React StrictMode
 * double-mount cancelling an in-flight request) from reaching Next.js's dev
 * error overlay as an `unhandledRejection: AbortError`.
 *
 * It only suppresses rejections whose reason is an AbortError — genuine
 * network/API/runtime rejections are left untouched and surface normally.
 */
export default function AbortErrorSilencer() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { name?: unknown } | null | undefined;
      if (reason?.name === "AbortError") {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
