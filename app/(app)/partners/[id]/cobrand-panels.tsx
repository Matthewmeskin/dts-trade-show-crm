"use client";

import { useActionState, useState } from "react";
import { SubmitButton, inputClass } from "@/components/form";
import {
  REBATE_TEST_RANGE,
  STACK_FLOOR_DOLLARS,
  stackCheck,
  suggestCode,
} from "@/lib/partners";
import { saveCobrand, saveTerms, type PartnerState } from "../actions";

const small = inputClass.replace("py-2", "py-1.5");
const empty: PartnerState = { error: null };

export function CobrandForm({
  partnerId,
  name,
  code,
  publicName,
  logoUrl,
  active,
}: {
  partnerId: string;
  name: string;
  code: string | null;
  publicName: string | null;
  logoUrl: string | null;
  active: boolean;
}) {
  const [state, action] = useActionState(saveCobrand, empty);
  const [codeValue, setCode] = useState(code ?? "");
  const err = state.fieldErrors ?? {};
  const liveCodeChanging = !!code && active && codeValue !== code;
  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Code</span>
        <div className="flex gap-2">
          <input
            name="code"
            value={codeValue}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder={suggestCode(name) || "partner-code"}
            className={small}
          />
          {!codeValue ? (
            <button
              type="button"
              onClick={() => setCode(suggestCode(name))}
              className="whitespace-nowrap text-xs font-medium text-sky-700 hover:underline"
            >
              Use suggestion
            </button>
          ) : null}
        </div>
        <span className="block text-xs text-slate-400">
          Goes in their page links and on every quote from them. Pick it once — changing it later breaks links already
          in their kit.
        </span>
        {err.code ? <span className="block text-xs text-dts-maroon">{err.code}</span> : null}
      </label>
      {liveCodeChanging ? (
        <label className="flex items-center gap-1.5 text-xs text-amber-800">
          <input type="checkbox" name="confirm_code_change" className="h-4 w-4 accent-dts-maroon" />
          Change the code anyway
        </label>
      ) : null}
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Name exhibitors see</span>
        <input name="public_name" defaultValue={publicName ?? name} className={small} />
        {err.public_name ? <span className="block text-xs text-dts-maroon">{err.public_name}</span> : null}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-slate-700">Logo link</span>
        <input name="logo_url" defaultValue={logoUrl ?? ""} placeholder="https://… (a PNG or SVG they host, or we host)" className={small} />
        {err.logo_url ? <span className="block text-xs text-dts-maroon">{err.logo_url}</span> : null}
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="cobrand_active" defaultChecked={active} className="mt-0.5 h-4 w-4 accent-dts-maroon" />
        <span>
          Cobranding on
          <span className="block text-xs text-slate-400">
            Only once the partner has agreed. Their pages go live on the next sync, for the shows ticked below that are
            published.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-600">Saved.</span> : null}
      </div>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
      className="text-xs font-medium text-sky-700 hover:underline"
      title={url}
    >
      {copied ? "Copied" : "Copy kit link"}
    </button>
  );
}

/**
 * Terms, and the stack check from the plan's guardrails: rebate plus rep
 * commission must still leave DTS $30 and half the margin on a typical load.
 */
export function TermsForm({
  partnerId,
  model,
  rebatePct,
  markupPct,
  basis,
  note,
}: {
  partnerId: string;
  model: string | null;
  rebatePct: number | null;
  markupPct: number | null;
  basis: string | null;
  note: string | null;
}) {
  const [state, action] = useActionState(saveTerms, empty);
  const [m, setM] = useState(model ?? "");
  const [rebate, setRebate] = useState(rebatePct != null ? String(rebatePct) : "");
  const [b, setB] = useState(basis ?? "before_rebate");
  const [margin, setMargin] = useState("150");
  const [commission, setCommission] = useState("");
  const check =
    m === "rebate" && rebate !== "" && commission !== ""
      ? stackCheck({
          margin: Number(margin) || 0,
          rebatePct: Number(rebate) || 0,
          commissionPct: Number(commission) || 0,
          commissionBasis: b === "after_rebate" ? "after_rebate" : "before_rebate",
        })
      : null;
  const outOfRange = m === "rebate" && rebate !== "" && (Number(rebate) < REBATE_TEST_RANGE[0] || Number(rebate) > REBATE_TEST_RANGE[1]);

  return (
    <form action={action} className="space-y-2.5">
      <input type="hidden" name="partner_id" value={partnerId} />
      <div className="flex flex-wrap gap-3 text-sm">
        {[
          ["", "Not set"],
          ["rebate", "Rebate (DTS bills the exhibitor)"],
          ["markup", "Markup (partner bills)"],
        ].map(([v, l]) => (
          <label key={v} className="flex items-center gap-1.5">
            <input type="radio" name="incentive_model" value={v} checked={m === v} onChange={() => setM(v)} className="accent-dts-maroon" />
            {l}
          </label>
        ))}
      </div>
      {m === "rebate" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Rebate, % of gross margin</span>
            <input name="rebate_pct" inputMode="decimal" value={rebate} onChange={(e) => setRebate(e.target.value)} className={small} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium text-slate-700">Rep commission figured</span>
            <select name="commission_basis" value={b} onChange={(e) => setB(e.target.value)} className={small}>
              <option value="before_rebate">Before the rebate</option>
              <option value="after_rebate">After the rebate</option>
            </select>
          </label>
          <p className="col-span-2 text-xs text-slate-400">
            Paid quarterly on paid invoices only. Starting range to test: {REBATE_TEST_RANGE[0]}–{REBATE_TEST_RANGE[1]}%.
            {outOfRange ? <span className="text-amber-700"> This is outside it.</span> : null}
          </p>
        </div>
      ) : m === "markup" ? (
        <div className="space-y-1">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-700">Partner markup, %</span>
            <input name="markup_pct" inputMode="decimal" defaultValue={markupPct ?? ""} className={small} />
          </label>
          <p className="text-xs text-amber-800">
            Markup partners go through the credit application first, and counsel confirms whether they need their own broker
            authority before the agreement is signed.
          </p>
        </div>
      ) : null}
      <textarea
        name="terms_note"
        rows={2}
        defaultValue={note ?? ""}
        placeholder="Who handles claims, who the exhibitor calls, agreement date…"
        className={small}
      />

      {m === "rebate" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="mb-2 font-medium text-slate-800">Stack check</div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-slate-600">
              Typical load margin, $
              <input inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} className={small} />
            </label>
            <label className="space-y-1 text-xs text-slate-600">
              Rep commission, % of margin
              <input inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} placeholder="e.g. 20" className={small} />
            </label>
          </div>
          {check ? (
            <div className={`mt-2 text-xs ${check.ok ? "text-emerald-700" : "text-dts-maroon"}`}>
              Rebate ${check.rebate.toFixed(2)} · commission ${check.commission.toFixed(2)} · DTS keeps ${check.dtsKeeps.toFixed(2)} (
              {Math.round(check.keepsShare * 100)}%). {check.ok ? "Passes." : check.reasons.join(" ")}
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-400">
              Enter the rebate and the rep&apos;s commission. DTS has to keep at least ${STACK_FLOOR_DOLLARS} and half the margin.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save terms</SubmitButton>
        {state.error ? <span className="text-sm text-dts-maroon">{state.error}</span> : null}
        {state.ok ? <span className="text-sm text-emerald-600">Saved.</span> : null}
      </div>
    </form>
  );
}
