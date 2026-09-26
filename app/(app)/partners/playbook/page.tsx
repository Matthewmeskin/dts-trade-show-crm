import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { SimpleMarkdown } from "@/components/simple-markdown";
import { formatDate, dayOf } from "@/lib/format";
import { PartnersNav, loadPeople } from "../parts";
import { EditSection } from "./edit-section";

export const dynamic = "force-dynamic";

/**
 * The admin kit, kept in the CRM so the process runs without any one person:
 * the pitch, the script, the qualification bar, the daily workflow, the
 * handoff template, the signals and the weekly targets. Admins edit it here.
 */
export default async function PlaybookPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const [{ data: sections }, { data: me }, people] = await Promise.all([
    supabase.from("playbook_sections").select("*").order("sort"),
    supabase.from("profiles").select("role").eq("id", claims?.claims?.sub ?? "").maybeSingle(),
    loadPeople(supabase),
  ]);
  const isAdmin = me?.role === "admin";
  const names = new Map(people.map((p) => [p.id, p.name]));
  const reps = people.filter((p) => p.bookingUrl);

  return (
    <div>
      <PageHeader
        title="Partner playbook"
        description="What we say, who we book, and how we hold ourselves to it. The sales admin works from this every day."
      />
      <PartnersNav active="playbook" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {(sections ?? []).length ? (
            (sections ?? []).map((s) => (
              <Card key={s.key}>
                <CardHeader title={s.title} />
                <div className="p-5">
                  <SimpleMarkdown text={s.body} />
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">
                      {s.updated_by ? `Edited by ${names.get(s.updated_by) ?? "—"} · ${formatDate(dayOf(s.updated_at))}` : "From the Partner Growth Plan"}
                    </span>
                    {isAdmin ? <EditSection sectionKey={s.key} title={s.title} body={s.body} /> : null}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState icon="documents" title="No playbook yet" />
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Rep booking links" icon="calendar" />
            <div className="p-5 text-sm">
              {reps.length ? (
                <ul className="space-y-2">
                  {reps.map((r) => (
                    <li key={r.id}>
                      <a href={r.bookingUrl!} target="_blank" rel="noreferrer" className="font-medium text-sky-700 hover:underline">
                        {r.name} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-slate-500">
                  No booking links yet. An admin adds each rep&apos;s Calendly / Bookings link on the Users page.
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
