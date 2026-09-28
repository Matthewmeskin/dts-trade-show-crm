"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/form";
import { sendManifestNow, type SendState } from "./actions";

export function SendNow({ partnerId, showId, kind, to }: { partnerId: string; showId: string; kind: "inbound" | "outbound"; to: string }) {
  const [state, action] = useActionState(sendManifestNow, { error: null } as SendState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="partner_id" value={partnerId} />
      <input type="hidden" name="show_id" value={showId} />
      <input type="hidden" name="kind" value={kind} />
      <SubmitButton pendingLabel="Sending…">Send now to {to}</SubmitButton>
      {state.error ? <p className="text-sm text-dts-maroon">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-emerald-700">{state.message}</p> : null}
    </form>
  );
}
