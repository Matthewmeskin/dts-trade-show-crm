import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SubmitButton } from "@/components/form";
import { triggerScan } from "./actions";
import { LoadList } from "./load-list";

export const dynamic = "force-dynamic";

const CONF_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export default async function LoadFinderPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tms_load_candidates")
    .select("*")
    .eq("ai_is_candidate", true)
    .eq("review_status", "new");

  const candidates = (data ?? []).sort(
    (a, b) =>
      (CONF_RANK[a.ai_confidence ?? "low"] ?? 2) - (CONF_RANK[b.ai_confidence ?? "low"] ?? 2) ||
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  return (
    <div>
      <PageHeader
        title="Load Finder"
        description="AI-flagged TMS loads that look like trade-show freight. Add the real ones as tracked shipments."
        actions={
          <form action={triggerScan}>
            <SubmitButton pendingLabel="Starting…">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="sparkles" className="h-4 w-4" /> Scan now
              </span>
            </SubmitButton>
          </form>
        }
      />

      {candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon="sparkles"
            title="No candidates to review"
            description="Run a scan (or wait for the daily one) to surface trade-show loads from the TMS."
          />
        </Card>
      ) : (
        <LoadList candidates={candidates} />
      )}
    </div>
  );
}
