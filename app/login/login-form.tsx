"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";
const buttonClass =
  "w-full rounded-lg bg-dts-maroon px-4 py-2.5 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

/**
 * Forgot-password: an email-only form that asks Supabase for a reset link.
 * One DTS login spans every portal, so the link (and the new password) apply
 * everywhere, not just the CRM.
 */
function ResetForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The server asks the n8n relay to mint a recovery link and mail it from
      // the Hamilton mailbox; the link lands on /reset-password here.
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Could not send the reset link.");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <p className="text-sm text-slate-600">
        Enter your email and we’ll send a link to set a new password. It applies to every DTS
        portal.
      </p>
      <div className="space-y-1.5">
        <label htmlFor="reset-email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="reset-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      {sent && !error ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          If an account exists for {email}, a reset link is on its way. Check your inbox and
          junk folder; the link is good for one hour.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <button type="submit" disabled={busy || sent} className={buttonClass}>
        {busy ? "Sending…" : sent ? "Link sent" : "Send reset link"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="block w-full text-center text-sm text-dts-maroon hover:underline"
      >
        Back to sign in
      </button>
    </form>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/";
  const [resetMode, setResetMode] = useState(params.get("reset") === "1");
  const resetDone = params.get("reset") === "done";

  if (resetMode) return <ResetForm onBack={() => setResetMode(false)} />;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <input type="hidden" name="redirect" value={redirect} />

      {resetDone ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Password updated. Sign in with your new password.
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-slate-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-slate-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
        <div className="text-right">
          <button
            type="button"
            onClick={() => setResetMode(true)}
            className="text-xs text-dts-maroon hover:underline"
          >
            Forgot password?
          </button>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
