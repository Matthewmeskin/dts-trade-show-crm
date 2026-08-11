import { createClient } from "@/lib/supabase/server";
import { SetPasswordForm } from "./set-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set your password · DTS Trade Show CRM" };

export default async function SetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-dts-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dts-logo.png"
            alt="DTS — Diversified Transportation Services"
            className="mx-auto mb-4 h-14 w-auto"
          />
          <h1 className="font-heading text-xl font-semibold text-slate-900">
            Set your password
          </h1>
          <p className="mt-1 text-sm text-dts-midgrey">
            {user?.email
              ? `Finish setting up ${user.email}`
              : "Choose a password to finish setting up your account"}
          </p>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
