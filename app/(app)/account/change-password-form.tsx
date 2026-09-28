"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon";

/**
 * The current password is re-checked before the change so a screen someone
 * walked away from can't be used to swap it.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two new passwords don’t match.");
    if (password === current) return setError("The new password must be different from the current one.");
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (authErr) throw new Error("The current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="username" autoComplete="username" value={email} readOnly />
      <div className="space-y-1.5">
        <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
          Current password
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className={inputClass}
        />
      </div>
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
      {done ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Password updated. Use it the next time you sign in to any DTS portal.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">At least 8 characters.</p>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-dts-maroon px-4 py-2 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Update password"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Forgot your current password? Sign out and use “Forgot password?” on the login page.
      </p>
    </form>
  );
}
