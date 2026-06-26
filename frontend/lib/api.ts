import type { CompareResult } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function compareProducts(
  product: string,
  priority: string,
  category?: string,
  signal?: AbortSignal
): Promise<CompareResult> {
  const response = await fetch(`${API_URL}/api/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product,
      priority,
      ...(category?.trim() ? { category: category.trim() } : {}),
    }),
    signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.detail || `Request failed (${response.status})`);
  }

  return (await response.json()) as CompareResult;
}

export type AgentKey = "search" | "review" | "ranking";
export type AgentStatus = "pending" | "active" | "done";

export interface AgentStageEvent {
  agent: AgentKey;
  status: AgentStatus;
  message: string;
}

export interface StreamHandlers {
  onStage?: (stage: AgentStageEvent) => void;
  onResult: (result: CompareResult) => void;
  onError: (message: string) => void;
}

/**
 * Subscribe to the live comparison stream (Server-Sent Events). Drives the
 * agent pipeline UI in real time and resolves with the final result.
 *
 * Returns a cleanup function that closes the connection.
 */
export function streamComparison(
  product: string,
  priority: string,
  category: string | undefined,
  handlers: StreamHandlers
): () => void {
  const params = new URLSearchParams({ product, priority });
  if (category?.trim()) params.set("category", category.trim());

  const source = new EventSource(`${API_URL}/api/compare/stream?${params.toString()}`);
  let settled = false;

  const close = () => {
    settled = true;
    source.close();
  };

  source.addEventListener("stage", (e) => {
    try {
      handlers.onStage?.(JSON.parse((e as MessageEvent).data) as AgentStageEvent);
    } catch {
      /* ignore malformed stage event */
    }
  });

  source.addEventListener("result", (e) => {
    try {
      handlers.onResult(JSON.parse((e as MessageEvent).data) as CompareResult);
    } catch {
      handlers.onError("Received a malformed response from the server");
    } finally {
      close();
    }
  });

  // Server-sent application error (carries a payload).
  source.addEventListener("error", (e) => {
    const data = (e as MessageEvent).data;
    if (data) {
      try {
        const parsed = JSON.parse(data) as { detail?: string };
        handlers.onError(parsed.detail || "Comparison failed");
      } catch {
        handlers.onError("Comparison failed");
      }
      close();
    }
  });

  // Transport-level failure (no payload). EventSource also fires onerror after
  // we close the stream ourselves, so ignore it once settled.
  source.onerror = () => {
    if (settled) return;
    if (source.readyState === EventSource.CLOSED) {
      handlers.onError("Connection to the server was lost");
      close();
    }
  };

  return close;
}
