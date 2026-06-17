import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Constants } from "@/lib/database.types";
import {
  TASK_STATUS_META,
  TASK_PRIORITY_META,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";
import { formatDate, daysUntil } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; assignee?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select(
      "id, title, due_date, status, priority, assigned_to, assignee:profiles!tasks_assigned_to_fkey(full_name, email), related_show:shows!tasks_related_show_id_fkey(id, show_name), related_exhibitor:exhibitors!tasks_related_exhibitor_id_fkey(id, company_name), related_carrier:carriers!tasks_related_carrier_id_fkey(id, carrier_name), related_venue:venues!tasks_related_venue_id_fkey(id, venue_name), related_shipment:shipments!tasks_related_shipment_id_fkey(id, pro_number)",
    )
    .order("due_date", { ascending: true, nullsFirst: false });

  if (sp.status && (Constants.public.Enums.task_status as readonly string[]).includes(sp.status))
    query = query.eq("status", sp.status as TaskStatus);
  if (sp.priority && (Constants.public.Enums.task_priority as readonly string[]).includes(sp.priority))
    query = query.eq("priority", sp.priority as TaskPriority);
  if (sp.assignee) query = query.eq("assigned_to", sp.assignee);
  if (sp.q?.trim()) query = query.ilike("title", `%${sp.q.trim()}%`);

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  const rows = tasks ?? [];

  const statusTabs = [{ label: "All", value: "" }].concat(
    Constants.public.Enums.task_status.map((s) => ({ label: TASK_STATUS_META[s].label, value: s })),
  );
  const tabHref = (value: string) => {
    const p = new URLSearchParams();
    if (value) p.set("status", value);
    for (const k of ["priority", "assignee", "q"] as const) if (sp[k]) p.set(k, sp[k]!);
    return `/tasks${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything your team needs to action, across every record."
        actions={
          <Link
            href="/tasks/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New task
          </Link>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1">
        {statusTabs.map((t) => {
          const active = (sp.status ?? "") === t.value;
          return (
            <Link
              key={t.label}
              href={tabHref(t.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-dts-maroon text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2">
        {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
        <select name="priority" defaultValue={sp.priority ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All priorities</option>
          {Constants.public.Enums.task_priority.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_META[p].label}</option>
          ))}
        </select>
        <select name="assignee" defaultValue={sp.assignee ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All assignees</option>
          {(profiles ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.full_name?.trim() || p.email || "Unnamed"}</option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search title…" className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon" />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="tasks" title="No tasks match" description="Create a task or adjust your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Task</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Assignee</th>
                  <th className="px-5 py-3">Due</th>
                  <th className="px-5 py-3">Related</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((t) => {
                  const sm = TASK_STATUS_META[t.status];
                  const pm = TASK_PRIORITY_META[t.priority];
                  const overdue =
                    t.status !== "completed" &&
                    t.due_date != null &&
                    (daysUntil(t.due_date) ?? 0) < 0;
                  const related = relatedFor(t);
                  return (
                    <tr key={t.id} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/tasks/${t.id}`} className="font-medium text-slate-900 group-hover:text-dts-maroon">
                          {t.title}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={sm.badge}>{sm.label}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge className={pm.badge}>{pm.label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {t.assignee?.full_name?.trim() || t.assignee?.email || (
                          <span className="text-slate-300">Unassigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {t.due_date ? (
                          <span className={overdue ? "font-medium text-dts-maroon" : "text-slate-600"}>
                            {formatDate(t.due_date)}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {related ? (
                          <Link href={related.href} className="text-dts-blue hover:underline">
                            {related.label}
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
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

type TaskRowRelations = {
  related_show: { id: string; show_name: string } | null;
  related_exhibitor: { id: string; company_name: string } | null;
  related_carrier: { id: string; carrier_name: string } | null;
  related_venue: { id: string; venue_name: string } | null;
  related_shipment: { id: string; pro_number: string | null } | null;
};

function relatedFor(t: TaskRowRelations): { label: string; href: string } | null {
  if (t.related_show) return { label: t.related_show.show_name, href: `/shows/${t.related_show.id}` };
  if (t.related_exhibitor)
    return { label: t.related_exhibitor.company_name, href: `/exhibitors/${t.related_exhibitor.id}` };
  if (t.related_shipment)
    return {
      label: t.related_shipment.pro_number ? `PRO ${t.related_shipment.pro_number}` : "Shipment",
      href: `/shipments/${t.related_shipment.id}`,
    };
  if (t.related_carrier)
    return { label: t.related_carrier.carrier_name, href: `/carriers/${t.related_carrier.id}` };
  if (t.related_venue) return { label: t.related_venue.venue_name, href: `/venues/${t.related_venue.id}` };
  return null;
}
