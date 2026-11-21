import type { NextConfig } from "next";

// Static security headers for every response (site review S1). The
// Content-Security-Policy needs a per-request nonce, so it is set in
// proxy.ts instead.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Never publish browser source maps (site review S5).
  productionBrowserSourceMaps: false,
  // File uploads (backlog 27b): the bucket caps files at 10 MB; allow a
  // little more for the rest of the form. Default would be 1 MB / 10 MB.
  experimental: {
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
