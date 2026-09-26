import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { PartnersNav, loadPeople } from "../parts";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function ImportPartnersPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const people = await loadPeople(supabase);
  return (
    <div>
      <PageHeader
        title="Import partners"
        description="Paste the tiered target list straight from Excel or Google Sheets."
      />
      <PartnersNav active="import" />
      <ImportForm people={people} me={claims?.claims?.sub ?? ""} />
    </div>
  );
}
