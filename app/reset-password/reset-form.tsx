"use client";

import { useEffect, useState } from "react";
import { createRecoveryClient } from "@/lib/supabase/recovery";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

export function ResetPasswordForm() {
  const [ready, setReady] = useState<"checking" | "ok" | "none">("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createRecoveryClient();
    const tokenHash = new URLSearchParams(window.location.search).get("token_hash");
    // Links mailed by the n8n relay carry a one-time token hash; exchanging it
    // here signs this page in on a short recovery session. Older links put the
    // tokens in the URL fragment, which the client parses on its own.
    const session = tokenHash
      ? supabase.auth
          .verifyOtp({ token_hash: tokenHash, type: "recovery" })
          .then(({ data }) => data.session)
      : supabase.auth.getSession().then(({ data }) => data.session);
    session
      .then((s) => {
        if (s?.user) {
          setEmail(s.user.email ?? null);
          setReady("ok");
        } else {
          setReady("none");
        }
      })
      .catch(() => setReady("none"));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don’t match.");
    setSaving(true);
    try {
      const supabase = createRecoveryClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Drop the recovery session; the person signs in fresh with the new password.
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/login?reset=done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
      setSaving(false);
    }
  }

  const card = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

  if (ready === "checking") {
    return <div className={`${card} text-center text-sm text-slate-500`}>Checking your link…</div>;
  }
  if (ready === "none") {
    return (
      <div className={`${card} space-y-3 text-sm text-slate-600`}>
        <p>This reset link has expired or was already used.</p>
        <a href="/login?reset=1" className="block text-center text-dts-maroon hover:underline">
          Request a new reset link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`${card} space-y-4`}>
      {email ? (
        <p className="text-sm text-slate-600">
          Choosing a new password for <span className="font-medium text-slate-900">{email}</span>.
        </p>
      ) : null}
      <input type="hidden" name="username" autoComplete="username" value={email ?? ""} readOnly />
      <div className="space-y-1.5">
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
          Confirm new password
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-lg bg-dts-maroon px-4 py-2.5 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}
