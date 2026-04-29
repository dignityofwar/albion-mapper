import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'shared': fileURLToPath(new URL('../shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});
