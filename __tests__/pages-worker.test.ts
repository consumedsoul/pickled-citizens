import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';

// @ts-expect-error — build script is plain ESM JavaScript with no type declarations.
import { collectPublicPaths, buildWorkerCode } from '../scripts/write-pages-worker.mjs';

/**
 * The generated Cloudflare Pages worker decides which requests are served from
 * the ASSETS binding and which fall through to OpenNext. With a `_worker.js`
 * and no `_routes.json`, Pages sends EVERY request to the worker, so any
 * public/ file missing from its list is answered with Next's 404 page instead
 * of the file. That is exactly how /llms.txt and /robots.txt broke.
 */
describe('pages worker asset routing', () => {
  it('lists every file in public/ as a site-root path', async () => {
    const paths: string[] = await collectPublicPaths('public');
    const onDisk = await fs.readdir('public', { withFileTypes: true });

    for (const entry of onDisk) {
      if (entry.isFile() && entry.name !== '.DS_Store') {
        expect(paths).toContain(`/${entry.name}`);
      }
    }

    // Nested directories are walked, not just the top level.
    expect(paths.some((p) => p.startsWith('/images/'))).toBe(true);
    // Directories themselves are never asset paths.
    expect(paths).not.toContain('/images');
  });

  it('routes the text files crawlers ask for', async () => {
    const paths: string[] = await collectPublicPaths('public');
    expect(paths).toContain('/llms.txt');
    expect(paths).toContain('/robots.txt');
  });

  it('emits a worker that checks the asset set plus Next build output', async () => {
    const code: string = buildWorkerCode(['/llms.txt', '/robots.txt']);

    expect(code).toContain('"/llms.txt"');
    expect(code).toContain('"/robots.txt"');
    expect(code).toContain('/_next/');
    expect(code).toContain('env.ASSETS.fetch(request)');
    // A 404 from ASSETS must still fall through to the Next app.
    expect(code).toContain('opennext.fetch(request, env, ctx)');
  });
});
