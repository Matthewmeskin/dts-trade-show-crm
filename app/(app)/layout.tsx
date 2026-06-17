import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

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
    <div className="flex h-screen overflow-hidden bg-dts-bg">
      <Sidebar userName={userName} userEmail={userEmail} role={role} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
