import { PageHeader } from "@/components/ui";
import { RosterMatch } from "./roster-match";

export const metadata = { title: "Roster Match · DTS Trade Show CRM" };

export default function RosterMatchPage() {
  return (
    <div>
      <PageHeader
        title="Roster Match"
        description="Paste or upload a show's exhibitor list to see which companies are already your customers — with their tier, status, and lifetime value — and which are new prospects."
      />
      <RosterMatch />
    </div>
  );
}
