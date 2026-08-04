import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Idle-timer heartbeat. The client pings this (throttled) while the user is
 * genuinely active but not navigating — e.g. filling a long form — so the
 * proxy re-stamps the `dts-last-activity` cookie and the server-side idle timer
 * stays in sync with real activity. The proxy does all the work (it stamps the
 * cookie on every authenticated request); this handler only needs to return a
 * cheap 200. Unauthenticated callers are already redirected by the proxy.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
