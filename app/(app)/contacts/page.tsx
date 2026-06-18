import Link from "next/link";
import { LinkRow } from "@/components/link-row";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Constants } from "@/lib/database.types";
import { CONTACT_TYPE_META, type ContactType } from "@/lib/contacts";

export const dynamic = "force-dynamic";

type ContactRowEmbeds = {
  show: { id: string; show_name: string } | null;
  exhibitor: { id: string; company_name: string } | null;
  venue: { id: string; venue_name: string } | null;
  carrier: { id: string; carrier_name: string } | null;
};

function attachedTo(c: ContactRowEmbeds): { label: string; href: string } | null {
  if (c.show) return { label: c.show.show_name, href: `/shows/${c.show.id}` };
  if (c.exhibitor) return { label: c.exhibitor.company_name, href: `/exhibitors/${c.exhibitor.id}` };
  if (c.venue) return { label: c.venue.venue_name, href: `/venues/${c.venue.id}` };
  if (c.carrier) return { label: c.carrier.carrier_name, href: `/carriers/${c.carrier.id}` };
  return null;
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("contacts")
    .select(
      "id, first_name, last_name, title, company, email, phone, contact_type, show:shows!contacts_show_id_fkey(id, show_name), exhibitor:exhibitors(id, company_name), venue:venues(id, venue_name), carrier:carriers(id, carrier_name)",
    )
    .order("last_name", { nullsFirst: false })
    .order("first_name", { nullsFirst: false });

  if (sp.type && (Constants.public.Enums.contact_type as readonly string[]).includes(sp.type))
    query = query.eq("contact_type", sp.type as ContactType);
  if (sp.q?.trim()) {
    const term = sp.q.trim();
    query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,company.ilike.%${term}%`);
  }

  const { data: contacts } = await query;
  const rows = contacts ?? [];

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="People across shows, exhibitors, venues, and carriers."
        actions={
          <Link
            href="/contacts/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-dts-maroon px-3.5 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            <Icon name="plus" className="h-4 w-4" /> New contact
          </Link>
        }
      />

      <form className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <select name="type" defaultValue={sp.type ?? ""} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon">
          <option value="">All types</option>
          {Constants.public.Enums.contact_type.map((t) => (
            <option key={t} value={t}>{CONTACT_TYPE_META[t].label}</option>
          ))}
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name or company…" className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon" />
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Filter
        </button>
      </form>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon="contacts"
            title={sp.q || sp.type ? "No contacts match" : "No contacts yet"}
            description={sp.q || sp.type ? "Try a different filter." : "Add your first contact."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Attached to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((c) => {
                  const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed";
                  const meta = c.contact_type ? CONTACT_TYPE_META[c.contact_type] : null;
                  const att = attachedTo(c);
                  return (
                    <LinkRow key={c.id} href={`/contacts/${c.id}`} className="group hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 group-hover:text-dts-maroon">
                          {name}
                        </Link>
                        {c.title ? <div className="text-xs text-slate-400">{c.title}</div> : null}
                      </td>
                      <td className="px-5 py-3">
                        {meta ? <Badge className={meta.badge}>{meta.label}</Badge> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {c.company ?? <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {c.email ? <div>{c.email}</div> : null}
                        {c.phone ? <div className="text-xs text-slate-400">{c.phone}</div> : null}
                        {!c.email && !c.phone ? <span className="text-slate-300">—</span> : null}
                      </td>
                      <td className="px-5 py-3">
                        {att ? (
                          <Link href={att.href} className="text-dts-blue hover:underline">{att.label}</Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </LinkRow>
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
