"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

/** Admin only; RLS on app_settings refuses anyone else. */
export async function setPartnerTools(on: boolean): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update({ enabled: on }).eq("key", "partner_tools");
  if (error) return;
  await logActivity(supabase, {
    action: "updated",
    entityType: "setting",
    entityLabel: "Old partner tools",
    summary: on ? "Showed the old partner tools" : "Hid the old partner tools",
  });
  revalidatePath("/partners", "layout");
}
