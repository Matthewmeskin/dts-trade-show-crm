import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

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
    .single();

  const claimEmail = typeof claims.email === "string" ? claims.email : "";
  const userName = profile?.full_name?.trim() || profile?.email || claimEmail || "User";
  const userEmail = profile?.email || claimEmail || "";
  const role = profile?.role ?? "standard";

  return (
    <AppShell userName={userName} userEmail={userEmail} role={role}>
      {children}
    </AppShell>
  );
}
