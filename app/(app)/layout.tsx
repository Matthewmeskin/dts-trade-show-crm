import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { NoAccess } from "./no-access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  // The proxy already validated and refreshed this request's session, so here
  // we only need to *read* the verified identity. getClaims() verifies the
  // access token locally against the project's JWKS (ES256) — no network
  // round-trip to the auth server on each page render, unlike getUser().
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  // Proxy already gates this, but guard defensively for direct renders.
  if (!claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", claims.sub)
    .maybeSingle();

  const claimEmail = typeof claims.email === "string" ? claims.email : "";
  // Being signed in is not access. This deployment shares its login with the
  // payables, vetting and Exemplis portals, so most accounts that can
  // authenticate here were never granted the CRM; a row in profiles (whichever
  // schema dbSchema() selects) is the grant. This used to read
  // `profile?.role ?? "standard"`, which turned every one of those accounts
  // into a standard CRM user the moment they opened the URL.
  if (!profile) return <NoAccess email={claimEmail} />;

  const userName = profile.full_name?.trim() || profile.email || claimEmail || "User";
  const userEmail = profile.email || claimEmail || "";
  const role = profile.role;

  return (
    <AppShell userName={userName} userEmail={userEmail} role={role}>
      {children}
    </AppShell>
  );
}
