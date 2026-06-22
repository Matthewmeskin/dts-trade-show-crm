import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Don't reuse cached page segments when navigating between records. The
    // shared (app)/loading.tsx boundary otherwise lets the client Router Cache
    // serve a previously-viewed /shipments/[id] (or other dynamic record) when
    // clicking through to a different one — showing the wrong record's data.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
