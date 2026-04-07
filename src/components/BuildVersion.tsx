'use client';

import { BUILD_VERSION } from '@/lib/buildVersion';

export function BuildVersion() {
  if (!BUILD_VERSION) return null;
  return <span> · {BUILD_VERSION}</span>;
}
