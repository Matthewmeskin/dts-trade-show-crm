/**
 * Which Postgres schema this deployment's CRM tables live in.
 *
 * Production uses `public`. A test/staging deployment can point the SAME code
 * at a copy of the CRM living in another schema of a shared Supabase project
 * (e.g. `tradeshow`) by setting NEXT_PUBLIC_SUPABASE_SCHEMA=tradeshow in its
 * environment. Defaults to `public`, so existing deployments are unaffected.
 *
 * The cast keeps the generated Database types (written against `public`)
 * applying to the alternate schema — the table shapes are identical copies.
 */
export function dbSchema(): "public" {
  return (process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public") as "public";
}
