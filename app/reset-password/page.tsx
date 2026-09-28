import { Suspense } from "react";
import { ResetPasswordForm } from "./reset-form";

export const metadata = { title: "Set a new password · DTS Trade Show CRM" };

/**
 * Where a password-reset link lands. The link carries a short-lived recovery
 * session in the URL fragment; the form picks it up, the person chooses a new
 * password, and then signs in normally. One DTS login covers every portal, so
 * the new password applies to all of them.
 */
export default function ResetPasswordPage() {
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
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-dts-midgrey">
            Your DTS login · applies to every portal
          </p>
        </div>
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
