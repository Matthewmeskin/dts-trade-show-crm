"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { createUser, type UserFormState } from "./actions";

const initialState: UserFormState = { error: null };

type Mode = "invite" | "password";

/**
 * Add an internal user. Admin only — gated server-side. Two modes: email them
 * an invite to set their own password (default), or set a temporary password
 * yourself.
 *
 * Inputs are controlled (value/onChange) on purpose: a <form action> resets its
 * uncontrolled fields after every submit, including a failed validation, which
 * would wipe everything the user just typed.
 */
export function NewUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);
  const err = state.fieldErrors ?? {};

  const [mode, setMode] = useState<Mode>("invite");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("standard");

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        mode === m ? "bg-white text-dts-maroon shadow-sm" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="mode" value={mode} />

      <div className="sm:col-span-2">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
          {tab("invite", "Email an invite")}
          {tab("password", "Set a password")}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {mode === "invite"
            ? "We'll email them a link to set their own password. They can't sign in until they do."
            : "You set an initial password and share it with them. They can change it later."}
        </p>
      </div>

      <Field label="Full name" htmlFor="full_name" error={err.full_name}>
        <input
          id="full_name"
          name="full_name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className={inputClass}
          placeholder="e.g. Jane Smith"
        />
      </Field>

      <Field label="Email" htmlFor="email" required error={err.email}>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="name@dtsone.com"
        />
      </Field>

      {mode === "password" ? (
        <Field label="Temporary password" htmlFor="password" required error={err.password} hint="At least 8 characters. They can change it later.">
          <input
            id="password"
            name="password"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Set an initial password"
          />
        </Field>
      ) : null}

      <Field label="Role" htmlFor="role" hint="Admins can manage users.">
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={inputClass}
        >
          <option value="standard">Standard</option>
          <option value="admin">Admin</option>
        </select>
      </Field>

      {state.error ? (
        <p className="rounded-lg bg-dts-maroon/5 px-3 py-2 text-sm text-dts-maroon sm:col-span-2">
          {state.error}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={mode === "invite" ? "Sending…" : "Adding…"}>
          {mode === "invite" ? "Send invite" : "Add user"}
        </SubmitButton>
      </div>
    </form>
  );
}
