import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · DTS Trade Show CRM" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-dts-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-dts-maroon text-lg font-bold text-white">
            DTS
          </div>
          <h1 className="font-heading text-xl font-semibold text-slate-900">
            Trade Show CRM
          </h1>
          <p className="mt-1 text-sm text-dts-midgrey">
            Internal access · sign in to continue
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
