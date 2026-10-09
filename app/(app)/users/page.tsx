import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { UserContactControls } from "./user-contact-controls";

export const dynamic = "force-dynamic";

export const metadata = { title: "Team contacts · DTS Trade Show CRM" };

export default async function UsersPage() {
  const supabase = await createClient();

  // Admin-only page. Middleware already ensured a session; here we gate on role.
  const { data: claimsData } = await supabase.auth.getClaims();
  const uid = claimsData?.claims?.sub;
  if (!uid) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  if (me?.role !== "admin") redirect("/");

  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, phone, title, is_mha_default_contact, booking_url, created_at")
    .order("created_at");

  const rows = users ?? [];

  return (
    <div>
      <PageHeader
        title="Team contacts"
        description="Phone, title, booking link and the default MHA contact for the people who sign in here. Who has access, and whether they are an admin, is set on the DTS portal's Users page."
      />

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        Adding people, removing them and making someone an admin happens in one place for every DTS
        portal:{" "}
        <a
          href="https://dts-ap-portal.vercel.app/users"
          className="font-medium text-dts-blue hover:underline"
        >
          the portal&apos;s Users page
        </a>
        . This page keeps the CRM&apos;s own contact details.
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="users" title="No users yet" description="Give someone Trade Show CRM access on the portal's Users page and they appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((u) => {
                  const name = u.full_name?.trim() || "—";
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3 font-medium text-slate-900">{name}</td>
                      <td className="px-5 py-3 text-slate-600">{u.email ?? "—"}</td>
                      <td className="px-5 py-3">
                        <UserContactControls
                          id={u.id}
                          phone={u.phone}
                          title={u.title}
                          isDefault={u.is_mha_default_contact}
                          bookingUrl={u.booking_url}
                        />
                      </td>
                      <td className="px-5 py-3">
                        {u.role === "admin" ? (
                          <Badge className="bg-dts-maroon/10 text-dts-maroon">Admin</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">Standard</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
