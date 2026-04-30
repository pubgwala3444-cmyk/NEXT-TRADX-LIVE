const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  experimental: {
    // Keep mongodb out of the webpack bundle — required for the native /
    // dynamic `require()` calls inside the driver to work at runtime.
    serverComponentsExternalPackages: ['mongodb'],

    // Next.js's automatic file tracer misses several files inside the
    // `mongodb` package because the driver loads them through conditional /
    // dynamic requires (e.g. ./mongocryptd_manager, ./client-side-encryption/*,
    // bson native bindings, etc.). When standalone output ships without
    // those files the API route crashes at runtime with:
    //     Error: Cannot find module './mongocryptd_manager'
    // -> /api/auth/login (and every other Mongo-touching route) returns 500.
    //
    // Forcing the tracer to copy the full mongodb + bson trees into the
    // standalone bundle fixes the deployed runtime.
    outputFileTracingIncludes: {
      '/api/**/*': [
        './node_modules/mongodb/**/*',
        './node_modules/bson/**/*',
        './node_modules/mongodb-connection-string-url/**/*',
        './node_modules/@mongodb-js/saslprep/**/*',
        './node_modules/sparse-bitfield/**/*',
        './node_modules/memory-pager/**/*',
      ],
    },
  },
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
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
          { key: "Access-Control-Allow-Origin", value: process.env.CORS_ORIGINS || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
