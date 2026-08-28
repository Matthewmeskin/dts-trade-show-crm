import { signOut } from "@/app/login/actions";

/**
 * Shown to a signed-in account that holds no row in profiles.
 *
 * The login is shared with the other DTS portals, so "signed in" says nothing
 * about whether this person was ever given the CRM — every payables, vetting
 * and Exemplis account can reach this URL. Access here is membership in
 * profiles and nothing else, and the database enforces the same rule
 * independently: without that row every CRM table returns empty rather than
 * relying on this page to be rendered.
 */
export function NoAccess({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-dts-bg px-4">
      <div className="w-full max-w-md text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dts-logo.png"
          alt="DTS — Diversified Transportation Services"
          className="mx-auto mb-4 h-14 w-auto"
        />
        <h1 className="font-heading text-xl font-semibold text-slate-900">
          Trade Show CRM
        </h1>
        <p className="mt-3 text-sm text-dts-midgrey">
          {email ? <span className="font-medium text-slate-700">{email}</span> : "This account"}{" "}
          is signed in, but has not been given access to the Trade Show CRM.
        </p>
        <p className="mt-2 text-sm text-dts-midgrey">
          Your DTS login is shared across every portal, so this is not a problem
          with your account — an admin just needs to grant this one app from the
          Users page on the operations dashboard.
        </p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-white"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
