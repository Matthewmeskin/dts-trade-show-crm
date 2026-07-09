import type { Enums } from "@/lib/database.types";

export type ForcedReason = Enums<"forced_reason">;

/** Reasons a move-out gets force-shipped, in the order shown in the picker. */
export const FORCED_REASONS: ForcedReason[] = [
  "carrier_no_show",
  "paperwork_error",
  "missed_check_in",
  "other",
];

export const FORCED_REASON_META: Record<ForcedReason, { label: string; hint?: string }> = {
  carrier_no_show: {
    label: "Carrier didn't show up",
    hint: "Our carrier missed the move-out / driver check-in deadline.",
  },
  paperwork_error: {
    label: "Paperwork error",
    hint: "The MHA / outbound BOL was wrong or missing at the service desk.",
  },
  missed_check_in: {
    label: "Missed carrier check-in deadline",
    hint: "Check-in wasn't completed in time, so the contractor rerouted the freight.",
  },
  other: { label: "Other", hint: "Something else — tell us what happened." },
};

/**
 * The date the "successful move-outs" dashboard counter begins tallying. Set to
 * the day after this feature shipped so the streak starts fresh rather than
 * back-counting historical loads.
 */
export const MOVE_OUT_COUNTER_EPOCH = "2026-07-10";
