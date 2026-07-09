import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { LocalDateTime } from "@/components/local-time";
import { ACTION_META } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ACTIONS = ["created", "updated", "status_changed", "forced", "unforced", "deleted"] as const;

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; action?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("activity_log")
    .select(
      "id, created_at, action, entity_type, entity_id, entity_label, summary, actor:profiles(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(250);

  if (sp.user) query = query.eq("user_id", sp.user);
  if (sp.action && (ACTIONS as readonly string[]).includes(sp.action)) query = query.eq("action", sp.action);
  const term = sp.q?.trim();
  if (term) {
    const safe = term.replace(/[(),]/g, " ");
    query = query.or(`entity_label.ilike.%${safe}%,summary.ilike.%${safe}%`);
  }

  const [{ data: rows }, { data: users }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  const entries = rows ?? [];

  return (
    <div>
      <PageHeader
        title="Activity"
        description="A running log of who changed what — shipment edits, status changes, forced flags, and more."
      />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select
          name="user"
          defaultValue={sp.user ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
        >
          <option value="">All people</option>
          {(users ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name?.trim() || u.email}
            </option>
          ))}
        </select>
        <select
          name="action"
          defaultValue={sp.action ?? ""}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.label ?? a}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search shipment or change…"
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Filter
        </button>
      </form>

      <Card>
        {entries.length === 0 ? (
          <EmptyState icon="clock" title="No activity yet" description="Changes people make will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Who</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((e) => {
                  const meta = ACTION_META[e.action];
                  const who = e.actor?.full_name?.trim() || e.actor?.email || "System";
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 whitespace-nowrap text-slate-500">
                        <LocalDateTime iso={e.created_at} withTime />
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">{who}</td>
                      <td className="px-5 py-3">
                        {meta ? (
                          <Badge className={meta.badge}>{meta.label}</Badge>
                        ) : (
                          <span className="text-slate-500">{e.action}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {e.entity_type === "shipment" && e.entity_id ? (
                          <Link href={`/shipments/${e.entity_id}`} className="text-dts-blue hover:underline">
                            {e.entity_label ?? "Shipment"}
                          </Link>
                        ) : (
                          <span className="text-slate-700">{e.entity_label ?? e.entity_type}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{e.summary ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
