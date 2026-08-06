import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { RosterMatch } from "./roster-match";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roster Match · DTS Trade Show CRM" };

export default async function RosterMatchPage() {
  const supabase = await createClient();
  // Known show names (canonical) for the autocomplete, most-attended first.
  const { data } = await supabase
    .from("show_history_summary")
    .select("show_name")
    .order("exhibitor_count", { ascending: false });
  const shows = (data ?? []).map((r) => r.show_name).filter((s): s is string => !!s);

  return (
    <div>
      <PageHeader
        title="Roster Match"
        description="Paste or upload a show's exhibitor list to see which companies are already your customers — their tier, status, and lifetime value — and, when you pick the show, whether they've shipped it with you before. Save the roster as the show's confirmed 2026 attendance."
      />
      <RosterMatch shows={shows} />
    </div>
  );
}
