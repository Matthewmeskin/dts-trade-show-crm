import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge } from "@/components/ui";
import { LocalDateTime } from "@/components/local-time";
import { ACTION_META } from "@/lib/activity";

/** The change history for a single shipment, shown on its record page. */
export async function ShipmentActivity({ shipmentId }: { shipmentId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, created_at, action, summary, actor:profiles(full_name, email)")
    .eq("entity_type", "shipment")
    .eq("entity_id", shipmentId)
    .order("created_at", { ascending: false })
    .limit(50);

  const entries = data ?? [];

  return (
    <Card>
      <CardHeader title="Activity" icon="clock" />
      {entries.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-400">
          No changes recorded yet. Edits, status changes, and forced flags will show up here.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {entries.map((e) => {
            const meta = ACTION_META[e.action];
            const who = e.actor?.full_name?.trim() || e.actor?.email || "System";
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3">
                {meta ? (
                  <Badge className={`${meta.badge} mt-0.5 shrink-0`}>{meta.label}</Badge>
                ) : (
                  <span className="mt-0.5 shrink-0 text-xs text-slate-500">{e.action}</span>
                )}
                <div className="min-w-0 text-sm">
                  <p className="text-slate-700">{e.summary ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {who} · <LocalDateTime iso={e.created_at} withTime />
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
