import { confirmSetup } from "./actions";
import { ConfirmButton } from "./confirm-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your account · DTS Trade Show CRM" };

/**
 * Landing page for invite / password-reset email links. Renders an "Activate
 * account" button rather than verifying on load, so a background pre-fetch by
 * an email scanner can't burn the one-time token — verification runs only on
 * the click (a POST → confirmSetup).
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash = "", type = "", next = "/set-password" } = await searchParams;
  const valid = !!token_hash && !!type;

  return (
    <main className="flex min-h-screen items-center justify-center bg-dts-bg px-4">
      <div className="w-full max-w-sm text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/dts-logo.png"
          alt="DTS — Diversified Transportation Services"
          className="mx-auto mb-4 h-14 w-auto"
        />
        <h1 className="font-heading text-xl font-semibold text-slate-900">
          Set up your account
        </h1>

        {valid ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="mb-4 text-sm text-slate-500">
              Click below to confirm your invite and choose a password.
            </p>
            <form action={confirmSetup}>
              <input type="hidden" name="token_hash" value={token_hash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <ConfirmButton />
            </form>
          </div>
        ) : (
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This link is missing information. Ask an admin to resend your invite.
          </p>
        )}
      </div>
    </main>
  );
}
