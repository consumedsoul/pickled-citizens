'use client';

// NEXT_PUBLIC_BUILD_VERSION is inlined at build time by next.config.mjs `env`.
const BUILD_VERSION = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '';

export function BuildVersion() {
  if (!BUILD_VERSION) return null;
  return <span> · {BUILD_VERSION}</span>;
}
