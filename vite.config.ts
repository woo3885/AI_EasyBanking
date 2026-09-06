import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  base: process.env.GITHUB_PAGES_BASE ?? '/',
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    exclude: [
      ...configDefaults.exclude,
      '**/build/**',
      '**/coverage/**',
      'backend/**',
      'ai-engine/**',
    ],
  },
});
