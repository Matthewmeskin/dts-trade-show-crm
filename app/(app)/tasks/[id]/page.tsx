import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Constants } from "@/lib/database.types";
import {
  TASK_STATUS_META,
  TASK_PRIORITY_META,
} from "@/lib/tasks";
import { formatDate, formatCountdown, daysUntil } from "@/lib/format";
import { deleteTask, updateTaskStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function TaskRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: t } = await supabase
    .from("tasks")
    .select(
      "*, assignee:profiles!tasks_assigned_to_fkey(full_name, email), creator:profiles!tasks_created_by_fkey(full_name, email), related_show:shows!tasks_related_show_id_fkey(id, show_name), related_exhibitor:exhibitors!tasks_related_exhibitor_id_fkey(id, company_name), related_carrier:carriers!tasks_related_carrier_id_fkey(id, carrier_name), related_venue:venues!tasks_related_venue_id_fkey(id, venue_name), related_shipment:shipments!tasks_related_shipment_id_fkey(id, pro_number)",
    )
    .eq("id", id)
    .single();

  if (!t) notFound();

  const sm = TASK_STATUS_META[t.status];
  const pm = TASK_PRIORITY_META[t.priority];
  const overdue = t.status !== "completed" && t.due_date != null && (daysUntil(t.due_date) ?? 0) < 0;

  const relations = [
    t.related_show && { label: t.related_show.show_name, href: `/shows/${t.related_show.id}`, kind: "Show" },
    t.related_exhibitor && { label: t.related_exhibitor.company_name, href: `/exhibitors/${t.related_exhibitor.id}`, kind: "Exhibitor" },
    t.related_shipment && { label: t.related_shipment.pro_number ? `PRO ${t.related_shipment.pro_number}` : "Shipment", href: `/shipments/${t.related_shipment.id}`, kind: "Shipment" },
    t.related_carrier && { label: t.related_carrier.carrier_name, href: `/carriers/${t.related_carrier.id}`, kind: "Carrier" },
    t.related_venue && { label: t.related_venue.venue_name, href: `/venues/${t.related_venue.id}`, kind: "Venue" },
  ].filter(Boolean) as { label: string; href: string; kind: string }[];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/tasks" className="hover:text-slate-700">Tasks</Link>
        <span>/</span>
        <span className="text-slate-600">{t.title}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              {t.title}
            </h1>
            <Badge className={sm.badge}>{sm.label}</Badge>
            <Badge className={pm.badge}>{pm.label} priority</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/tasks/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="tasks" className="h-4 w-4" /> Edit
          </Link>
          <ConfirmDelete action={deleteTask} id={id} message="Delete this task? This cannot be undone." />
        </div>
      </div>

      {/* Quick status management */}
      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <form action={updateTaskStatus} className="flex items-center gap-2">
            <input type="hidden" name="id" value={id} />
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select name="status" defaultValue={t.status} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
              {Constants.public.Enums.task_status.map((s) => (
                <option key={s} value={s}>{TASK_STATUS_META[s].label}</option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-dts-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              Update
            </button>
          </form>
          {t.status !== "completed" ? (
            <form action={updateTaskStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="completed" />
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                <Icon name="tasks" className="h-4 w-4" /> Mark complete
              </button>
            </form>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Details" icon="tasks" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row
                label="Due date"
                value={
                  t.due_date ? (
                    <span className={overdue ? "text-dts-maroon" : ""}>
                      {formatDate(t.due_date)} · {formatCountdown(daysUntil(t.due_date))}
                    </span>
                  ) : null
                }
              />
              <Row label="Assignee" value={t.assignee?.full_name?.trim() || t.assignee?.email || null} />
              <Row label="Created by" value={t.creator?.full_name?.trim() || t.creator?.email || null} />
            </dl>
            {t.description ? (
              <div className="border-t border-slate-100 p-5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Description
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{t.description}</p>
              </div>
            ) : null}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Related records" icon="shows" />
            {relations.length === 0 ? (
              <EmptyState icon="shows" title="Not linked" description="This task isn't tied to a record." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {relations.map((r) => (
                  <li key={r.href} className="flex items-center justify-between px-5 py-3">
                    <Link href={r.href} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                      {r.label}
                    </Link>
                    <span className="text-xs text-slate-400">{r.kind}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800">
        {value ?? <span className="text-slate-300">—</span>}
      </dd>
    </div>
  );
}
