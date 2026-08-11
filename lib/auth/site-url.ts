import { headers } from "next/headers";

/**
 * Absolute base URL of this deployment, used to build links in emails Supabase
 * sends (invite / password-setup). Prefers NEXT_PUBLIC_SITE_URL when set;
 * otherwise derives it from the incoming request's forwarded host (Vercel sets
 * x-forwarded-* on every request). No trailing slash.
 */
export async function getSiteUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}
