import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { UploadForm } from "../upload-form";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const { data: shows } = await supabase
    .from("shows")
    .select("id, show_name, edition_year")
    .order("show_name");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Upload document" description="Attach a file to a show." breadcrumbs={[{ label: "Documents", href: "/documents" }]} />
      <UploadForm
        shows={(shows ?? []).map((s) => ({
          id: s.id,
          label: `${s.show_name}${s.edition_year ? ` ${s.edition_year}` : ""}`,
        }))}
        defaultShowId={show}
      />
    </div>
  );
}
