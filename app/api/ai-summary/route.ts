import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/dashboard";
import { generateSituationSummary } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  // Internal-only: require an authenticated user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const data = await loadDashboard();
  const result = await generateSituationSummary(data);
  return NextResponse.json(result);
}
