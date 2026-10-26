const nextConfig = {
  output: 'standalone',
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
    ];
    const rules = [{ source: "/(.*)", headers: security }];
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
