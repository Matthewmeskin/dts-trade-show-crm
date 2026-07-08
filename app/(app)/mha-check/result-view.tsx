"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { MhaResult } from "@/lib/mha/result";
import type { CheckResult } from "@/lib/mha/rules";
import type { MhaExtraction } from "@/lib/mha/extraction";

const BANNER: Record<
  string,
  { label: string; wrap: string; sub: string }
> = {
  passed: {
    label: "PASSED",
    wrap: "bg-emerald-50 ring-emerald-600/20 text-emerald-800",
    sub: "The two must-pass rules are satisfied.",
  },
  warning: {
    label: "NEEDS ATTENTION",
    wrap: "bg-amber-50 ring-amber-600/20 text-amber-800",
    sub: "No hard failures, but review the items below before the freight moves.",
  },
  failed: {
    label: "FAILED",
    wrap: "bg-red-50 ring-red-600/20 text-red-800",
    sub: "Fix the item(s) below at the service desk before you leave the booth.",
  },
  error: {
    label: "COULDN'T READ THE FORM",
    wrap: "bg-slate-100 ring-slate-400/30 text-slate-700",
    sub: "We couldn't read this upload reliably.",
  },
};

const SEVERITY_STYLE: Record<CheckResult["severity"], { dot: string; card: string; tag: string }> = {
  fail: { dot: "bg-red-500", card: "border-red-200 bg-red-50/40", tag: "text-red-700" },
  warn: { dot: "bg-amber-500", card: "border-amber-200 bg-amber-50/40", tag: "text-amber-700" },
  info: { dot: "bg-slate-400", card: "border-slate-200 bg-slate-50", tag: "text-slate-600" },
};

function CheckCard({ check }: { check: CheckResult }) {
  const s = SEVERITY_STYLE[check.severity];
  return (
    <div className={`rounded-xl border p-4 ${s.card}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{check.title}</p>
          <p className="mt-1 text-sm text-slate-600">{check.detail}</p>
          {(check.found || check.expected) && (
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs">
              {check.found != null && (
                <div className="flex gap-1.5">
                  <dt className="text-slate-400">On the form:</dt>
                  <dd className="font-medium text-slate-700">{check.found || "—"}</dd>
                </div>
              )}
              {check.expected != null && (
                <div className="flex gap-1.5">
                  <dt className="text-slate-400">Should be:</dt>
                  <dd className="font-medium text-slate-700">{check.expected}</dd>
                </div>
              )}
            </dl>
          )}
          <p className={`mt-2 text-[11px] font-mono uppercase tracking-wide ${s.tag}`}>{check.code}</p>
        </div>
      </div>
    </div>
  );
}

function loadLine(result: MhaResult): string {
  if (result.matchMethod !== "none") {
    return `Matched to load ${result.loadReference ?? result.loadId ?? ""}. Checked against the booking too.`;
  }
  if (result.loadNumberInput) {
    return `We couldn't find load "${result.loadNumberInput}" in our system. We checked the form itself and here's what we found.`;
  }
  return "No load number was provided, so we checked the form itself.";
}

/** Fields worth showing in the transcription panel, with confidence keys. */
function extractedRows(x: MhaExtraction): { label: string; value: string; conf?: string }[] {
  const acc = Object.entries(x.accessorials ?? {})
    .filter(([k, v]) => k !== "other_text" && v === true)
    .map(([k]) => k.replace(/_/g, " "));
  if (x.accessorials?.other_text) acc.push(x.accessorials.other_text);
  return [
    { label: "General contractor", value: x.gc_detected ?? "unknown" },
    { label: "Carrier", value: x.carrier?.name ?? "—", conf: x.confidence?.["carrier.name"] },
    { label: "Bill to", value: x.bill_to?.company ?? "—", conf: x.confidence?.["bill_to.company"] },
    { label: "Show", value: x.show_name ?? "—", conf: x.confidence?.["show_name"] },
    { label: "Booth", value: x.booth_number ?? "—", conf: x.confidence?.["booth_number"] },
    {
      label: "Pieces / weight",
      value: `${x.total_pieces ?? "—"} pcs / ${x.total_weight_lbs ?? "—"} lbs`,
    },
    { label: "Freight terms", value: x.freight_terms ?? "—" },
    {
      label: "Destination",
      value: [x.destination?.city, x.destination?.state, x.destination?.zip].filter(Boolean).join(", ") || "—",
    },
    { label: "Accessorials", value: acc.length ? acc.join(", ") : "none marked" },
    {
      label: "Signed",
      value: x.exhibitor_signature_present == null ? "—" : x.exhibitor_signature_present ? "yes" : "no",
    },
  ];
}

export function MhaResultView({ result }: { result: MhaResult }) {
  const [open, setOpen] = useState(false);
  const banner = BANNER[result.status] ?? BANNER.error;

  const fails = result.checks.filter((c) => c.severity === "fail");
  const warns = result.checks.filter((c) => c.severity === "warn");
  const infos = result.checks.filter((c) => c.severity === "info");
  const isImage = !!result.fileUrl && !/\.pdf(\?|$)/i.test(result.fileUrl);

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl px-5 py-4 ring-1 ring-inset ${banner.wrap}`}>
        <p className="text-lg font-bold tracking-wide">{banner.label}</p>
        <p className="mt-0.5 text-sm opacity-90">{result.error || banner.sub}</p>
        <p className="mt-2 text-sm opacity-80">{loadLine(result)}</p>
      </div>

      {result.lowResolution && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-sm text-amber-800">
          This photo looks low-resolution. Extraction is less reliable — if anything looks off, retake it
          straight-on in good light and submit again.
        </div>
      )}

      {(fails.length > 0 || warns.length > 0) && (
        <div className="space-y-3">
          {fails.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
          {warns.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
        </div>
      )}

      {result.status === "passed" && fails.length === 0 && warns.length === 0 && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm text-emerald-800">
          Carrier is not DTS and the freight is billed to DTS. Nothing needs fixing.
        </div>
      )}

      {infos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
          {infos.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
        </div>
      )}

      {result.extracted && (
        <Card>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="font-medium text-slate-900">What we read from your form</span>
            <span className="text-sm text-slate-400">{open ? "Hide" : "Show"}</span>
          </button>
          {open && (
            <div className="grid gap-x-8 gap-y-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-2">
              {isImage && result.fileUrl && (
                <a
                  href={result.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sm:col-span-2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.fileUrl}
                    alt="Uploaded MHA"
                    className="max-h-64 w-auto rounded-lg border border-slate-200"
                  />
                </a>
              )}
              {!isImage && result.fileUrl && (
                <a
                  href={result.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-dts-blue hover:underline sm:col-span-2"
                >
                  Open the uploaded PDF
                </a>
              )}
              {extractedRows(result.extracted).map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <dt className="text-sm text-slate-400">{row.label}</dt>
                  <dd className="text-right text-sm font-medium text-slate-800">
                    {row.value}
                    {row.conf === "low" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-700">
                        low conf.
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
