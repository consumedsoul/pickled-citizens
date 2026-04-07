'use client';

// process.env.NEXT_PUBLIC_BUILD_VERSION is statically replaced at build
// time in client components. Must NOT be a Server Component.
export function BuildVersion() {
  const version = process.env.NEXT_PUBLIC_BUILD_VERSION;
  if (!version) return null;
  return <span> · {version}</span>;
}
