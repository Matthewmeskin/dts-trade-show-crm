"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

type Result =
  | { status: "ok"; summary: string }
  | { status: "unconfigured" }
  | { status: "empty" }
  | { status: "error"; message: string };

export function AiSummaryCard({ showName }: { showName: string | null }) {
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai-summary", { cache: "no-store" });
      setResult((await res.json()) as Result);
    } catch {
      setResult({ status: "error", message: "Could not reach the summary service." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="AI summary"
        icon="sparkles"
        action={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-xs font-medium text-slate-500 transition hover:text-dts-maroon disabled:opacity-50"
          >
            {loading ? "Generating…" : "Refresh"}
          </button>
        }
      />
      <div className="flex flex-1 flex-col justify-center p-5">
        {loading ? (
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        ) : result?.status === "ok" ? (
          <p className="text-sm leading-relaxed text-slate-700">{result.summary}</p>
        ) : result?.status === "empty" ? (
          <p className="text-sm text-slate-400">
            No active or upcoming show to summarize yet.
          </p>
        ) : result?.status === "unconfigured" ? (
          <div className="rounded-xl border border-dashed border-dts-lightblue bg-dts-lightblue/10 p-4 text-sm text-slate-600">
            {showName ? (
              <>
                Live situational summaries for{" "}
                <span className="font-medium text-slate-700">{showName}</span> are
                ready to switch on — add your{" "}
                <code className="rounded bg-white px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>{" "}
                to <code className="rounded bg-white px-1 py-0.5 text-xs">.env.local</code> and refresh.
              </>
            ) : (
              <>
                Add your{" "}
                <code className="rounded bg-white px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>{" "}
                to enable live AI summaries.
              </>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 text-sm text-dts-maroon">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {result?.status === "error" ? result.message : "Something went wrong."}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
