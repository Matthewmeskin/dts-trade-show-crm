"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  HEARTBEAT_THROTTLE_MS,
  LAST_ACTIVITY_STORAGE_KEY,
  LOGOUT_BROADCAST_KEY,
  SESSION_EXP_COOKIE,
} from "@/lib/auth/session-timeout";

/** Passive events that count as the user still being present. */
const ACTIVITY_EVENTS = [
  "pointerdown",
  "keydown",
  "scroll",
  "wheel",
  "touchstart",
  "mousemove",
] as const;

/**
 * Client-side inactivity monitor for the authenticated app shell.
 *
 * Warns the user shortly before their idle session expires, signs them out when
 * it does, and keeps the server-side idle timer in sync (via a throttled
 * heartbeat) so an actively-working user is never bounced mid-task. The proxy
 * remains the source of truth — this layer is UX + cross-tab coordination.
 */
export function IdleTimeoutMonitor() {
  const [warnOpen, setWarnOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Initialised in the mount effect below — avoids an impure Date.now() call
  // during render. Zero means "not yet primed"; the ticker skips until then.
  const lastActivityRef = useRef(0);
  const lastHeartbeatRef = useRef(0);
  const loggingOutRef = useRef(false);
  // Absolute hard-cap deadline (epoch ms), read from the server-set cookie.
  const sessionExpRef = useRef(0);

  const sendHeartbeat = useCallback((now: number) => {
    lastHeartbeatRef.current = now;
    // Fire-and-forget; the proxy re-stamps the activity cookie on this request.
    fetch("/api/session/heartbeat", {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      // Offline or transient — the next activity tick will retry.
    });
  }, []);

  const logout = useCallback(async (reason: "timeout" | "expired") => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      // Broadcast (reason:timestamp) so sibling tabs redirect too, then clear
      // the local session.
      window.localStorage.setItem(LOGOUT_BROADCAST_KEY, `${reason}:${Date.now()}`);
      await createClient().auth.signOut();
    } catch {
      // Even if signOut fails, force a full navigation — the proxy will see the
      // stale/expired cookies and finish clearing the session.
    }
    window.location.assign(`/login?reason=${reason}`);
  }, []);

  const registerActivity = useCallback(
    (now: number) => {
      lastActivityRef.current = now;
      try {
        window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      } catch {
        // Private mode / storage disabled — the in-memory ref still works.
      }
      if (now - lastHeartbeatRef.current > HEARTBEAT_THROTTLE_MS) {
        sendHeartbeat(now);
      }
    },
    [sendHeartbeat],
  );

  // Prime the timers on mount (kept out of render to stay pure).
  useEffect(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastHeartbeatRef.current = now;

    // Read the absolute-expiry deadline the proxy set (readable cookie).
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${SESSION_EXP_COOKIE}=([^;]+)`),
    );
    const exp = match ? Number(decodeURIComponent(match[1])) : NaN;
    if (Number.isFinite(exp)) sessionExpRef.current = exp;
  }, []);

  // Activity listeners (throttled so mousemove doesn't thrash).
  useEffect(() => {
    let throttled = false;
    const onActivity = () => {
      if (throttled) return;
      throttled = true;
      window.setTimeout(() => {
        throttled = false;
      }, 1000);
      registerActivity(Date.now());
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, [registerActivity]);

  // Cross-tab coordination: adopt the newest activity time and follow logouts.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LOGOUT_BROADCAST_KEY && e.newValue) {
        loggingOutRef.current = true;
        const reason = e.newValue.split(":")[0] === "expired" ? "expired" : "timeout";
        window.location.assign(`/login?reason=${reason}`);
        return;
      }
      if (e.key === LAST_ACTIVITY_STORAGE_KEY && e.newValue) {
        const other = Number(e.newValue);
        if (Number.isFinite(other) && other > lastActivityRef.current) {
          lastActivityRef.current = other;
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // The clock. One ticker drives both the warning countdown and expiry.
  useEffect(() => {
    const tick = () => {
      if (!lastActivityRef.current) return; // not primed yet
      const now = Date.now();

      // Absolute hard cap — fires regardless of activity, cannot be extended.
      if (sessionExpRef.current && now >= sessionExpRef.current) {
        void logout("expired");
        return;
      }

      const remaining = IDLE_TIMEOUT_MS - (now - lastActivityRef.current);
      if (remaining <= 0) {
        void logout("timeout");
        return;
      }
      if (remaining <= IDLE_WARNING_MS) {
        setWarnOpen(true);
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else if (warnOpen) {
        setWarnOpen(false);
      }
    };

    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [logout, warnOpen]);

  const staySignedIn = useCallback(() => {
    const now = Date.now();
    registerActivity(now);
    sendHeartbeat(now); // Refresh the server cookie immediately.
    setWarnOpen(false);
  }, [registerActivity, sendHeartbeat]);

  if (!warnOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2
          id="idle-timeout-title"
          className="font-heading text-lg font-semibold text-slate-900"
        >
          Still there?
        </h2>
        <p className="mt-2 text-sm text-dts-midgrey">
          You&rsquo;ll be signed out in{" "}
          <span className="font-semibold tabular-nums text-slate-900">
            {secondsLeft}s
          </span>{" "}
          due to inactivity.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={staySignedIn}
            className="flex-1 rounded-lg bg-dts-maroon px-4 py-2.5 text-sm font-medium text-white transition hover:bg-dts-maroon-dark"
          >
            Stay signed in
          </button>
          <button
            type="button"
            onClick={() => void logout("timeout")}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
