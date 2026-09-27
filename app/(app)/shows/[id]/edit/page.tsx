import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui";
import { decodeKitFacts, kitFillForShow } from "@/lib/kit-reader";
import { ShowForm } from "../../show-form";
import { updateShow } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kit?: string }>;
}) {
  const { id } = await params;
  const { kit } = await searchParams;
  const supabase = await createClient();

  const [{ data: show }, { data: venues }, { data: contacts }] =
    await Promise.all([
      supabase.from("shows").select("*").eq("id", id).single(),
      supabase.from("venues").select("id, venue_name, city, state").order("venue_name"),
      supabase
        .from("contacts")
        .select("id, first_name, last_name, company")
        .order("last_name"),
    ]);

  if (!show) notFound();

  // Sent from the kit reader: the kit's dates and addresses for the fields
  // that are still empty. Prefilled only - nothing is saved until Save changes.
  const kitFacts = decodeKitFacts(kit);
  const fill = kitFacts ? kitFillForShow(kitFacts, show) : null;
  const shown = fill ? { ...show, ...fill.values } : show;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Edit show" breadcrumbs={[{ label: "Shows", href: "/shows" }, { label: show.show_name, href: "/shows/" + id }]} />
      {fill ? (
        <Card className="mb-5 space-y-2 border-sky-200 bg-sky-50/40 p-5 text-sm">
          <h2 className="font-semibold text-slate-900">
            {fill.filled.length
              ? `Filled ${fill.filled.length} empty field${fill.filled.length === 1 ? "" : "s"} from the exhibitor kit`
              : "Nothing to fill from the kit"}
          </h2>
          {fill.filled.length ? (
            <>
              <p className="text-xs text-slate-500">
                Nothing is saved yet. Check each against the kit, fix anything that&apos;s off, then Save changes at the
                bottom. Fields that already had a value were left alone.
              </p>
              <ul className="space-y-1 text-xs text-slate-700">
                {fill.filled.map((f) => (
                  <li key={f.label}>
                    <span className="font-medium">{f.label}:</span> {f.value}
                    {f.where ? <span className="text-slate-400"> — {f.where}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs text-slate-500">Every field the kit covers already has a value on this show.</p>
          )}
          {fill.skipped.length ? (
            <ul className="space-y-1 text-xs text-amber-800">
              {fill.skipped.map((f) => (
                <li key={f.label}>
                  <span className="font-medium">{f.label}:</span> {f.value} — {f.why}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
      <ShowForm
        action={updateShow}
        show={shown}
        venues={venues ?? []}
        contacts={contacts ?? []}
        submitLabel="Save changes"
      />
    </div>
  );
}
