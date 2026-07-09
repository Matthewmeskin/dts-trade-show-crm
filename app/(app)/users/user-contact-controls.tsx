"use client";

import { setUserContact } from "./actions";

/**
 * Inline contact editor for a user row: phone + title, saved on blur, and a
 * "Default MHA contact" checkbox saved on change. The whole row is one form so
 * every save carries all three fields (an unchecked checkbox is simply absent).
 */
export function UserContactControls({
  id,
  phone,
  title,
  isDefault,
}: {
  id: string;
  phone: string | null;
  title: string | null;
  isDefault: boolean;
}) {
  const save = (form: HTMLFormElement | null) => form?.requestSubmit();

  return (
    <form action={setUserContact} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="phone"
        type="tel"
        defaultValue={phone ?? ""}
        placeholder="Phone"
        onBlur={(e) => save(e.currentTarget.form)}
        className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
      />
      <input
        name="title"
        defaultValue={title ?? ""}
        placeholder="Title"
        onBlur={(e) => save(e.currentTarget.form)}
        className="w-32 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-dts-maroon focus:ring-1 focus:ring-dts-maroon"
      />
      <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600">
        <input
          name="is_mha_default_contact"
          type="checkbox"
          defaultChecked={isDefault}
          onChange={(e) => save(e.currentTarget.form)}
          className="h-4 w-4 accent-dts-maroon"
        />
        Default MHA contact
      </label>
    </form>
  );
}
