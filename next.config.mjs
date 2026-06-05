import { execSync } from 'child_process';

// Generate build version at build time: v20260407.1935
// Inlined into the bundle via `env` below (webpack DefinePlugin replaces
// process.env.NEXT_PUBLIC_BUILD_VERSION with this literal at build time),
// so there is no generated source file to track or dirty the working tree.
function getBuildVersion() {
  try {
    return execSync('TZ=America/Los_Angeles date +v%Y%m%d.%H%M', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: getBuildVersion(),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Content-Security-Policy is set per-request by middleware.ts
          // so a fresh nonce can be generated for each response.
        ],
      },
    ];
  },
};

export default nextConfig;
