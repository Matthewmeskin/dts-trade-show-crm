"use client";

import { useActionState, useState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/form";
import { createUser, type UserFormState } from "./actions";

const initialState: UserFormState = { error: null };

/**
 * Add an internal user (email + password). Admin only — gated server-side.
 *
 * Inputs are controlled (value/onChange) on purpose: a <form action> resets its
 * uncontrolled fields after every submit, including a failed validation, which
 * would wipe everything the user just typed. Holding the values in state keeps
 * them on screen so they only need to fix the flagged field.
 */
export function NewUserForm() {
  const [state, formAction] = useActionState(createUser, initialState);
  const err = state.fieldErrors ?? {};

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("standard");

  return (
    <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <SubmitButton pendingLabel="Adding…">Add user</SubmitButton>
      </div>
    </form>
  );
}
