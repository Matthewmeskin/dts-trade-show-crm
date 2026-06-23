import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState, Badge } from "@/components/ui";
import { NewUserForm } from "./user-form";
import { UserRowControls } from "./user-row-controls";

export const dynamic = "force-dynamic";

export const metadata = { title: "Users · DTS Trade Show CRM" };

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
    .select("id, full_name, email, role, created_at")
    .order("created_at");

  const rows = users ?? [];

  return (
    <div>
      <PageHeader
        title="Users"
        description="Internal team members who can sign in to the CRM."
      />

      <Card className="mb-6">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">Add a user</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Creates a sign-in with the email and temporary password you set.
          </p>
        </div>
        <div className="px-5 py-5">
          <NewUserForm />
        </div>
      </Card>

      <Card>
        {rows.length === 0 ? (
          <EmptyState icon="users" title="No users yet" description="Add your first team member above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 text-right">Manage</th>
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
                        {u.role === "admin" ? (
                          <Badge className="bg-dts-maroon/10 text-dts-maroon">Admin</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">Standard</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <UserRowControls
                          id={u.id}
                          role={u.role}
                          name={u.full_name?.trim() || u.email || ""}
                          isSelf={u.id === uid}
                        />
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
