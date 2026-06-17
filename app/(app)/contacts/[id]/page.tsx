import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, Badge, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ConfirmDelete } from "@/components/confirm-delete";
import { CONTACT_TYPE_META } from "@/lib/contacts";
import { deleteContact } from "../actions";

export const dynamic = "force-dynamic";

export default async function ContactRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase
    .from("contacts")
    .select(
      "*, show:shows!contacts_show_id_fkey(id, show_name), exhibitor:exhibitors(id, company_name), venue:venues(id, venue_name), carrier:carriers(id, carrier_name)",
    )
    .eq("id", id)
    .single();

  if (!c) notFound();

  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed contact";
  const meta = c.contact_type ? CONTACT_TYPE_META[c.contact_type] : null;

  const attachments = [
    c.show && { label: c.show.show_name, href: `/shows/${c.show.id}`, kind: "Show" },
    c.exhibitor && { label: c.exhibitor.company_name, href: `/exhibitors/${c.exhibitor.id}`, kind: "Exhibitor" },
    c.venue && { label: c.venue.venue_name, href: `/venues/${c.venue.id}`, kind: "Venue" },
    c.carrier && { label: c.carrier.carrier_name, href: `/carriers/${c.carrier.id}`, kind: "Carrier" },
  ].filter(Boolean) as { label: string; href: string; kind: string }[];

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-sm text-slate-400">
        <Link href="/contacts" className="hover:text-slate-700">Contacts</Link>
        <span>/</span>
        <span className="text-slate-600">{name}</span>
      </div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              {name}
            </h1>
            {meta ? <Badge className={meta.badge}>{meta.label}</Badge> : null}
          </div>
          {(c.title || c.company) && (
            <p className="mt-1 text-sm text-slate-500">
              {[c.title, c.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/contacts/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="contacts" className="h-4 w-4" /> Edit
          </Link>
          <ConfirmDelete action={deleteContact} id={id} message={`Delete "${name}"? This cannot be undone.`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader title="Details" icon="contacts" />
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="Email" value={c.email ? <a href={`mailto:${c.email}`} className="text-dts-blue hover:underline">{c.email}</a> : null} />
              <Row label="Phone" value={c.phone ? <a href={`tel:${c.phone}`} className="text-dts-blue hover:underline">{c.phone}</a> : null} />
              <Row label="Title" value={c.title} />
              <Row label="Company" value={c.company} />
            </dl>
            {c.notes ? (
              <div className="border-t border-slate-100 p-5">
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Notes</div>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{c.notes}</p>
              </div>
            ) : null}
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Attached to" icon="shows" />
            {attachments.length === 0 ? (
              <EmptyState icon="contacts" title="Not attached" description="This contact isn't linked to a record." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {attachments.map((a) => (
                  <li key={a.href} className="flex items-center justify-between px-5 py-3">
                    <Link href={a.href} className="text-sm font-medium text-slate-900 hover:text-dts-maroon">
                      {a.label}
                    </Link>
                    <span className="text-xs text-slate-400">{a.kind}</span>
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
