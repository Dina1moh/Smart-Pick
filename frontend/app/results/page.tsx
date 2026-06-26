import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import ResultsClient from "@/components/ResultsClient";

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
        </div>
      }
    >
      <ResultsClient />
    </Suspense>
  );
}
