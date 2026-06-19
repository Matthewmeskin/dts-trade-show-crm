import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/form";
import { formatCurrency } from "@/lib/format";
import { importCandidate, dismissCandidate, triggerScan } from "./actions";

export const dynamic = "force-dynamic";

const CONF_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };
const CONF_BADGE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  medium: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  low: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20",
};

export default async function LoadFinderPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tms_load_candidates")
    .select("*")
    .eq("ai_is_candidate", true)
    .eq("review_status", "new");

  const candidates = (data ?? []).sort(
    (a, b) =>
      (CONF_RANK[a.ai_confidence ?? "low"] ?? 2) - (CONF_RANK[b.ai_confidence ?? "low"] ?? 2) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  return (
    <div>
      <PageHeader
        title="Load Finder"
        description="AI-flagged TMS loads that look like trade-show freight. Add the real ones as tracked shipments."
        actions={
          <form action={triggerScan}>
            <SubmitButton pendingLabel="Starting…">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="sparkles" className="h-4 w-4" /> Scan now
              </span>
            </SubmitButton>
          </form>
        }
      />

      {candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title="No candidates to review"
            description="Run a scan (or wait for the daily one) to surface trade-show loads from the TMS."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {candidates.map((c) => (
            <Card key={c.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">Load {c.load_number}</span>
                    <Badge className={CONF_BADGE[c.ai_confidence ?? "low"]}>
                      {c.ai_confidence ?? "low"} confidence
                    </Badge>
                    {c.mode ? (
                      <span className="text-xs text-slate-400">{c.mode}</span>
                    ) : null}
                    {c.tms_status ? (
                      <span className="text-xs text-slate-400">· {c.tms_status}</span>
                    ) : null}
                    {c.matched_venue ? (
                      <Badge className="bg-dts-blue/10 text-dts-blue">{c.matched_venue}</Badge>
                    ) : null}
                  </div>

                  <p className="text-sm text-slate-600">{c.ai_reason}</p>

                  <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2">
                    {c.customer_name ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Customer:</dt>
                        <dd className="truncate font-medium text-slate-600">{c.customer_name}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-slate-400">Pickup:</dt>
                      <dd className="truncate">{c.pickup_location ?? "—"}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="shrink-0 text-slate-400">Delivery:</dt>
                      <dd className="truncate">{c.delivery_location ?? "—"}</dd>
                    </div>
                    {c.carrier_name ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Carrier:</dt>
                        <dd className="truncate">{c.carrier_name}</dd>
                      </div>
                    ) : null}
                    {c.weight != null ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Weight:</dt>
                        <dd>{c.weight} lbs{c.pieces != null ? ` · ${c.pieces} pcs` : ""}</dd>
                      </div>
                    ) : null}
                    {c.po_ref ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">PO ref:</dt>
                        <dd className="truncate">{c.po_ref}</dd>
                      </div>
                    ) : null}
                    {c.shipper_number ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Shipper #:</dt>
                        <dd className="truncate">{c.shipper_number}</dd>
                      </div>
                    ) : null}
                    {c.billed_amount != null || c.cost_amount != null ? (
                      <div className="flex gap-1.5">
                        <dt className="shrink-0 text-slate-400">Financials:</dt>
                        <dd className="truncate">
                          {formatCurrency(c.billed_amount, { cents: true })} billed
                          {" · "}
                          {formatCurrency(c.cost_amount, { cents: true })} cost
                          {c.billed_amount != null && c.cost_amount != null
                            ? ` · ${formatCurrency(c.billed_amount - c.cost_amount, { cents: true })} margin`
                            : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <form action={importCandidate}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="load_number" value={c.load_number} />
                    <SubmitButton pendingLabel="Adding…">Add shipment</SubmitButton>
                  </form>
                  <form action={dismissCandidate}>
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
