"use client";

import { useFormStatus } from "react-dom";

export function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-dts-maroon px-4 py-2.5 text-sm font-medium text-white transition hover:bg-dts-maroon-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Activating…" : "Activate account"}
    </button>
  );
}
