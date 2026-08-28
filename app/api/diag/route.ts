import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dbSchema } from "@/lib/supabase/schema";

export const dynamic = "force-dynamic";

/**
 * Deployment self-check: reports whether this deployment is wired up correctly
 * (which env vars are present, which Supabase project + schema it targets, and
 * whether a real query succeeds). Deliberately reports only booleans and the
 * public host/schema — never a key value — so it is safe to hit unauthenticated
 * while diagnosing a fresh deployment.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let host: string | null = null;
  try {
    host = url ? new URL(url).host : null;
  } catch {
    host = `UNPARSEABLE: ${JSON.stringify(url)}`;
  }

  const env = {
    NEXT_PUBLIC_SUPABASE_URL: !!url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA ?? "(unset)",
    // Integration config — absent on a sandbox deployment by design, but the
    // TMS ingest 503s without the secret, so surface it here too.
    TMS_WEBHOOK_SECRET: !!process.env.TMS_WEBHOOK_SECRET,
    ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    N8N_SCAN_WEBHOOK_URL: !!process.env.N8N_SCAN_WEBHOOK_URL,
  };

  let query: { ok: boolean; exhibitors?: number; error?: string } = { ok: false };
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = await createClient();
      const { count, error } = await supabase
        .from("exhibitors")
        .select("id", { count: "exact", head: true });
      query = error ? { ok: false, error: error.message } : { ok: true, exhibitors: count ?? 0 };
    } catch (e) {
      query = { ok: false, error: (e as Error).message };
    }
  } else {
    query = { ok: false, error: "skipped — Supabase env vars missing" };
  }

  return NextResponse.json({ env, host, schemaInUse: dbSchema(), query }, {
    headers: { "cache-control": "no-store" },
  });
}
