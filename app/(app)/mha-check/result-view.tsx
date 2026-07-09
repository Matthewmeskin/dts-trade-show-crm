"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import type { MhaResult } from "@/lib/mha/result";
import type { CheckResult } from "@/lib/mha/rules";
import type { MhaExtraction } from "@/lib/mha/extraction";
import {
  buildChecklist,
  buildRecommendations,
  type ChecklistItem,
  type ChecklistStatus,
} from "@/lib/mha/checklist";

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
    label: "REVIEW BEFORE TURN-IN",
    wrap: "bg-amber-50 ring-amber-600/20 text-amber-800",
    sub: "No must-fix errors. Give the items below a look before you turn the form in at the general service contractor's service desk — and be sure to submit it before you leave the show.",
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

type Row = { label: string; value: string; conf?: string; hint?: string };

/** Fields worth showing in the transcription panel, with confidence keys. */
function extractedRows(x: MhaExtraction, result: MhaResult): Row[] {
  const acc = Object.entries(x.accessorials ?? {})
    .filter(([k, v]) => k !== "other_text" && v === true)
    .map(([k]) => k.replace(/_/g, " "));
  if (x.accessorials?.other_text) acc.push(x.accessorials.other_text);

  const missingFigures = x.total_pieces == null || x.total_weight_lbs == null;
  const haveBooked = result.loadPieces != null || result.loadWeight != null;
  const piecesHint =
    missingFigures && haveBooked
      ? `Our records: ${result.loadPieces ?? "—"} pcs / ${result.loadWeight ?? "—"} lbs`
      : undefined;

  return [
    { label: "General contractor", value: x.gc_detected ?? "unknown" },
    { label: "Carrier", value: x.carrier?.name ?? "—", conf: x.confidence?.["carrier.name"] },
    { label: "Bill to", value: x.bill_to?.company ?? "—", conf: x.confidence?.["bill_to.company"] },
    { label: "Show", value: x.show_name ?? "—", conf: x.confidence?.["show_name"] },
    { label: "Booth", value: x.booth_number ?? "—", conf: x.confidence?.["booth_number"] },
    {
      label: "Pieces / weight",
      value: `${x.total_pieces ?? "—"} pcs / ${x.total_weight_lbs ?? "—"} lbs`,
      hint: piecesHint,
    },
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

const CHECK_ICON: Record<ChecklistStatus, { glyph: string; cls: string }> = {
  pass: { glyph: "✓", cls: "bg-emerald-100 text-emerald-700" },
  fail: { glyph: "✕", cls: "bg-red-100 text-red-700" },
  warn: { glyph: "!", cls: "bg-amber-100 text-amber-700" },
  na: { glyph: "–", cls: "bg-slate-100 text-slate-400" },
};

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const icon = CHECK_ICON[item.status];
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${icon.cls}`}
        aria-hidden="true"
      >
        {icon.glyph}
      </span>
      <span className="flex-1 text-sm text-slate-700">{item.label}</span>
      {item.note ? (
        <span className="max-w-[45%] truncate text-right text-xs text-slate-400">{item.note}</span>
      ) : null}
    </div>
  );
}

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg border border-dts-blue/25 bg-white px-3 py-2">
      <code className="flex-1 text-xs leading-relaxed text-slate-700">{text}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        }}
        className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function MhaResultView({ result }: { result: MhaResult }) {
  const [open, setOpen] = useState(true);
  const banner = BANNER[result.status] ?? BANNER.error;

  const fails = result.checks.filter((c) => c.severity === "fail");
  const warns = result.checks.filter((c) => c.severity === "warn");
  const infos = result.checks.filter((c) => c.severity === "info");
  const isImage = !!result.fileUrl && !/\.pdf(\?|$)/i.test(result.fileUrl);

  const hasLoad = result.matchMethod !== "none" && !!result.loadId;
  const checklist = result.extracted
    ? buildChecklist(result.extracted, result.checks, hasLoad)
    : [];
  const recommendations = result.extracted
    ? buildRecommendations(
        result.extracted,
        hasLoad ? { pieces: result.loadPieces, weight: result.loadWeight } : null,
      )
    : [];

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

      {fails.length > 0 && (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">
            Please get this corrected at the service desk before you leave the booth.
          </p>
          <p className="mt-1 text-sm text-red-700">
            If it isn&apos;t fixed, the general contractor can hand your freight to their own carrier and
            re-route it — at a significant, avoidable cost billed back to you.
          </p>
        </div>
      )}

      {(fails.length > 0 || warns.length > 0) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {fails.length > 0 ? "Needs fixing" : "Worth a look before turn-in"}
          </p>
          {fails.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
          {warns.map((c) => (
            <CheckCard key={c.code} check={c} />
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-dts-blue/25 bg-dts-blue/5 p-5">
          <p className="text-sm font-semibold text-dts-blue">Recommendations</p>
          <div className="mt-3 space-y-4">
            {recommendations.map((r) => (
              <div key={r.title}>
                <p className="text-sm font-medium text-slate-900">{r.title}</p>
                <p className="mt-0.5 text-sm text-slate-600">{r.detail}</p>
                {r.copy ? <CopyLine text={r.copy} /> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {checklist.length > 0 && (
        <Card>
          <p className="px-5 pt-4 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            What we checked
          </p>
          <div className="divide-y divide-slate-50 pb-2">
            {checklist.map((item) => (
              <ChecklistRow key={item.label} item={item} />
            ))}
          </div>
        </Card>
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
              {extractedRows(result.extracted, result).map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3">
                  <dt className="text-sm text-slate-400">{row.label}</dt>
                  <dd className="text-right text-sm font-medium text-slate-800">
                    {row.value}
                    {row.conf === "low" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-semibold uppercase text-amber-700">
                        low conf.
                      </span>
                    )}
                    {row.hint && (
                      <span className="mt-0.5 block text-xs font-normal text-dts-blue">{row.hint}</span>
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
