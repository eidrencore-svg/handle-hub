/** @type {import('next').NextConfig} */
const nextConfig = {
  // Catalog + self-test data are read from disk at runtime by /api/scan and /status.
  outputFileTracingIncludes: {
    "/api/scan": ["./data/sites/*.json"],
    "/status": ["./data/sites/*.json"],
  },
};

module.exports = nextConfig;
