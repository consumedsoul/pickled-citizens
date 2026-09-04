import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['__tests__/**/*.test.ts'],
    // Agent worktrees under .claude/ contain full copies of the repo, including
    // __tests__. Without this, `vitest run` collects every copy and reports a
    // multiple of the real test count — and a stale worktree can fail CI for a
    // bug that does not exist on main.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', '.open-next/**'],
  },
});
