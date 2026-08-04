/**
 * Shared idle-session-timeout configuration.
 *
 * Supabase refresh tokens renew indefinitely, so without this an authenticated
 * session never expires — a real risk on shared office machines. We enforce an
 * inactivity timeout in two layers that share these constants:
 *
 *   1. proxy.ts — server-authoritative. A `dts-last-activity` cookie is stamped
 *      on every authenticated request; once it goes stale past IDLE_TIMEOUT_MS
 *      the session is cleared and the visitor is bounced to /login. Because it
 *      lives in the proxy it can't be defeated by disabling JavaScript.
 *   2. components/idle-timeout.tsx — client UX. Warns the user, counts down,
 *      and signs them out proactively so a left-open tab doesn't sit on a stale
 *      page. A throttled heartbeat keeps the server cookie fresh while the user
 *      is genuinely active (typing, no navigation) so they're never bounced
 *      mid-work.
 */

/** Minutes of inactivity before the session is ended. Override with env. */
const DEFAULT_IDLE_MINUTES = 30;

/** Max hours a session may live regardless of activity. Override with env. */
const DEFAULT_MAX_HOURS = 12;

function readPositiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : NaN;
  // Guard against blanks, 0, and garbage — fall back to the safe default.
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

/** Idle window, in milliseconds, after which the session is considered dead. */
export const IDLE_TIMEOUT_MS =
  readPositiveNumber(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES, DEFAULT_IDLE_MINUTES) *
  60_000;

/**
 * Absolute session lifetime, in milliseconds. A hard ceiling: once a session is
 * this old it's force-expired even if the user has been continuously active.
 * Caps the blast radius of a stolen/left-open session that idle refreshes would
 * otherwise keep alive forever.
 */
export const ABSOLUTE_SESSION_MS =
  readPositiveNumber(process.env.NEXT_PUBLIC_SESSION_MAX_HOURS, DEFAULT_MAX_HOURS) *
  3_600_000;

/** How long before expiry the client shows the "you're about to be signed out" warning. */
export const IDLE_WARNING_MS = 60_000;

/**
 * While active, the client pings the server at most this often to refresh the
 * activity cookie. Must be comfortably shorter than IDLE_TIMEOUT_MS so an
 * actively-working user's server-side timer never goes stale between pings.
 */
export const HEARTBEAT_THROTTLE_MS = 5 * 60_000;

/** httpOnly cookie holding the epoch-ms timestamp of the last seen activity. */
export const LAST_ACTIVITY_COOKIE = "dts-last-activity";

/** httpOnly cookie holding the epoch-ms timestamp the session began (set once). */
export const SESSION_START_COOKIE = "dts-session-start";

/**
 * Readable (non-httpOnly) cookie holding the absolute expiry epoch-ms. Exposed
 * to the client so it can proactively sign an active user out at the hard cap
 * instead of only on their next full-page navigation.
 */
export const SESSION_EXP_COOKIE = "dts-session-exp";

/** localStorage key used to sync the idle timer across tabs of the same origin. */
export const LAST_ACTIVITY_STORAGE_KEY = "dts:lastActivity";

/** localStorage key broadcast so other tabs redirect to /login on logout. */
export const LOGOUT_BROADCAST_KEY = "dts:loggedOutAt";

/** True when `lastActivityMs` is older than the idle window relative to `now`. */
export function isIdleExpired(lastActivityMs: number, now: number): boolean {
  return now - lastActivityMs > IDLE_TIMEOUT_MS;
}

/** True when a session started at `startMs` has passed its absolute lifetime. */
export function isSessionExpired(startMs: number, now: number): boolean {
  return now - startMs > ABSOLUTE_SESSION_MS;
}
