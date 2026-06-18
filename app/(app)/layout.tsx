import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy already gates this, but guard defensively for direct renders.
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name?.trim() || profile?.email || user.email || "User";
  const userEmail = profile?.email || user.email || "";
  const role = profile?.role ?? "standard";

  return (
    <AppShell userName={userName} userEmail={userEmail} role={role}>
      {children}
    </AppShell>
  );
}
