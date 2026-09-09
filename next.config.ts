import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photos arrive already compressed to ~300KB; this is headroom, not a target.
      bodySizeLimit: "4mb",
    },
  },
  /**
   * The checklists used to live at /close, from the weeks when closing was the
   * only thing they were for. They cover the open and the mid shift too, and a
   * prep cook walking twenty six items at six in the morning was being sent to
   * a URL that told him he was closing.
   *
   * Permanent, and kept rather than dropped, because the old address is printed
   * on paper and taped to a wall. A QR code is not something you can go back and
   * edit, so /close has to keep working for as long as those sheets are up.
   */
  /**
   * The service worker has to be allowed to go stale.
   *
   * Netlify serves everything in public/ with a long cache, and a service
   * worker the browser will not re-fetch is a service worker that cannot be
   * fixed or turned off. Browsers already bypass the HTTP cache for the worker
   * script itself, but saying it here means the answer does not depend on
   * which browser somebody is holding.
   */
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  async redirects() {
    return [
      { source: "/close", destination: "/checklists", permanent: true },
      {
        source: "/close/:path*",
        destination: "/checklists/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
