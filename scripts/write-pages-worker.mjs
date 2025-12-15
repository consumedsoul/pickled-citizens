import fs from 'node:fs/promises';

const code = `import opennext from "./opennext-worker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve static assets directly from the Pages asset binding.
    // This avoids 404s for /_next/* and /images/* when running OpenNext on Pages.
    if (
      url.pathname.startsWith("/_next/") ||
      url.pathname.startsWith("/images/") ||
      url.pathname === "/favicon.ico"
    ) {
      const assetResp = await env.ASSETS.fetch(request);
      if (assetResp.status !== 404) return assetResp;
    }

    return opennext.fetch(request, env, ctx);
  },
};
`;

await fs.writeFile('.open-next/pages/_worker.js', code, 'utf8');
