const nextConfig = {
  output: 'standalone',
  // SECURITY_HARDENING.md C6 — stop announcing the framework in every response.
  poweredByHeader: false,
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
    ],
  },
  // Renamed from experimental.serverComponentsExternalPackages in Next 15
  serverExternalPackages: ['mongodb'],
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
  },
  async headers() {
    // Emergent's preview embeds the app in an iframe, so framing stays open by default.
    // In production set FRAME_ANCESTORS (e.g. "'self'") to block clickjacking.
    const security = [
      { key: "Content-Security-Policy", value: `frame-ancestors ${process.env.FRAME_ANCESTORS || '*'};` },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      // SECURITY_HARDENING.md C3 — staged as Report-Only per the doc's own
      // caution: this is a real policy shipped for visibility first, not yet
      // enforced (frame-ancestors above is untouched; see its own comment on
      // why — Emergent's preview iframe). Tighten to a blocking CSP once a
      // report period confirms nothing legitimate trips it.
      { key: "Content-Security-Policy-Report-Only",
        value: "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self';" },
    ];
    const rules = [
      { source: "/(.*)", headers: security },
      // SECURITY_HARDENING.md C7 — these pages are per-visitor/authenticated;
      // the home page's long edge cache (fine for marketing) must never
      // apply here.
      { source: "/login", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/dashboard/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
    // Cross-origin API access only when explicitly configured (same-origin calls need none).
    if (process.env.CORS_ORIGINS && process.env.CORS_ORIGINS !== '*') {
      rules.push({
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      });
    }
    return rules;
  },
};

module.exports = nextConfig;
