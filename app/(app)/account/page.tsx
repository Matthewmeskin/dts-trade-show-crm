import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Account · DTS Trade Show CRM" };

/**
 * Account settings for the signed-in user. One DTS login spans every portal
 * (payables, vetting, Exemplis, tracking), so a password changed here changes
 * it everywhere.
 */
export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const email =
    typeof claimsData?.claims?.email === "string" ? claimsData.claims.email : "";

  return (
    <div>
      <PageHeader
        title="Account"
        description={`Signed in as ${email}. Your DTS login is shared across every portal.`}
      />
      <Card className="max-w-lg">
        <CardHeader title="Change password" />
        <div className="px-5 py-4">
          <ChangePasswordForm email={email} />
        </div>
      </Card>
    </div>
  );
}
