import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

// Generate build version at build time: v20260407.1935
// Written to a file so client components can import it directly
// (process.env.NEXT_PUBLIC_* isn't reliably replaced in all runtimes)
function getBuildVersion() {
  try {
    return execSync('TZ=America/Los_Angeles date +v%Y%m%d.%H%M', { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

const buildVersion = getBuildVersion();
try {
  writeFileSync(
    'src/lib/buildVersion.ts',
    `// Auto-generated at build time — do not edit\nexport const BUILD_VERSION = '${buildVersion}';\n`
  );
} catch { /* ignore in environments where this path is read-only */ }

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
