"use client";

import { useEffect, useState } from "react";
import { localPath } from "@/lib/dts-login";

/**
 * Landing point for single sign-on from the DTS operations hub. The token
 * arrives in the URL fragment (fragments never reach a server or its logs)
 * and is exchanged same-origin for this app's own session cookies. If that
 * fails, the CRM's own login form opens rather than sending the visitor back
 * to the hub, which would loop.
 */
export default function SsoPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("at") ?? "";
    const next = localPath(params.get("next"));
    // The token has done its job once read: scrub it from the address bar and
    // history before the network call.
    window.history.replaceState(null, "", "/auth/sso");

    const local = `/login?local=1&redirect=${encodeURIComponent(next)}`;
    if (!accessToken) {
      window.location.replace(local);
      return;
    }

    fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("sso failed");
        window.location.replace(next);
      })
      .catch(() => {
        setFailed(true);
        window.location.replace(local);
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-dts-bg px-4">
      <p className="text-sm text-dts-midgrey">{failed ? "Opening the sign-in page…" : "Signing you in…"}</p>
    </main>
  );
}
