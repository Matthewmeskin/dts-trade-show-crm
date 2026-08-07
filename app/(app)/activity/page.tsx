import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { RelativeTime } from "@/components/relative-time";
import { formatDateTime } from "@/lib/format";
import { ACTION_META, ENTITY_META } from "@/lib/activity";

export const dynamic = "force-dynamic";

export const metadata = { title: "Activity · DTS Trade Show CRM" };

const PAGE_SIZE = 50;

function actorName(actor: { full_name: string | null; email: string | null } | null): string {
  return actor?.full_name?.trim() || actor?.email?.trim() || "System";
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; action?: string; user?: string; page?: string }>;
}) {
  const { entity = "", action = "", user = "", page: pageParam } = await searchParams;
  const supabase = await createClient();

  const page = Math.max(1, Number(pageParam) || 1);
  const fromIdx = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("activity_log")
    .select("*, actor:profiles(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false });
  if (entity) query = query.eq("entity_type", entity);
  if (action) query = query.eq("action", action);
  if (user) query = query.eq("user_id", user);

  const [{ data: rows, count }, { data: people }] = await Promise.all([
    query.range(fromIdx, fromIdx + PAGE_SIZE - 1),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const entries = rows ?? [];
  const anyFilter = !!(entity || action || user);

  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    if (user) params.set("user", user);
    if (p > 1) params.set("page", String(p));
    return `/activity${params.toString() ? `?${params}` : ""}`;
  };

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

  return (
    <div>
      <PageHeader
        title="Activity"
        description="A running log of changes made across the CRM — who did what, and when."
      />

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <form className="flex flex-wrap items-center gap-2">
          <select name="entity" defaultValue={entity} className={selectClass}>
            <option value="">All records</option>
            {Object.entries(ENTITY_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.plural}
              </option>
            ))}
          </select>
          <select name="action" defaultValue={action} className={selectClass}>
            <option value="">All actions</option>
            {Object.entries(ACTION_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
          <select name="user" defaultValue={user} className={selectClass}>
            <option value="">All users</option>
            {(people ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name?.trim() || p.email || p.id}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Filter
          </button>
          {anyFilter ? (
            <Link href="/activity" className="text-sm font-medium text-slate-400 hover:text-slate-700">
              Clear
            </Link>
          ) : null}
        </form>
      </div>

      <Card>
        {entries.length === 0 ? (
          <EmptyState
            icon="clock"
            title={anyFilter ? "No matching activity" : "No activity yet"}
            description={
              anyFilter
                ? "Try a different record type, action, or user."
                : "Changes made across the CRM will show up here."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-50">
              {entries.map((e) => {
                const meta = ENTITY_META[e.entity_type];
                const am = ACTION_META[e.action];
                const href = meta?.href && e.entity_id ? meta.href(e.entity_id) : null;
                const label = e.entity_label ?? meta?.label ?? e.entity_type;
                return (
                  <li key={e.id} className="flex items-start gap-3 px-5 py-3.5">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                      <Icon name={meta?.icon ?? "clock"} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="font-medium text-slate-900">{actorName(e.actor)}</span>
                        {am ? (
                          <Badge className={am.badge}>{am.label}</Badge>
                        ) : (
                          <span className="text-slate-500">{e.action}</span>
                        )}
                        <span className="text-slate-400">{meta?.label ?? e.entity_type}</span>
                        {href ? (
                          <Link href={href} className="truncate font-medium text-dts-maroon hover:underline">
                            {label}
                          </Link>
                        ) : (
                          <span className="truncate font-medium text-slate-700">{label}</span>
                        )}
                      </div>
                      {e.summary ? (
                        <p className="mt-0.5 text-sm text-slate-500">{e.summary}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">
                      <RelativeTime iso={e.created_at} title={formatDateTime(e.created_at)} />
                    </span>
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={PAGE_SIZE}
              makeHref={makeHref}
            />
          </>
        )}
      </Card>
    </div>
  );
}
