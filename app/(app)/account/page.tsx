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
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const { required } = await searchParams;
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
      {required ? (
        <div className="mb-4 max-w-lg rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="font-heading font-semibold">Welcome — set your own password to continue.</div>
          <div className="mt-0.5 text-sm">
            You signed in with a temporary password. Enter it as the current password below, then
            choose one only you know. It works on every DTS portal.
          </div>
        </div>
      ) : null}
      <Card className="max-w-lg">
        <CardHeader title={required ? "Set your password" : "Change password"} />
        <div className="px-5 py-4">
          <ChangePasswordForm email={email} required={Boolean(required)} />
        </div>
      </Card>
    </div>
  );
}
