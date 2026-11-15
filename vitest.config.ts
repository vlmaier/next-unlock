import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@decky/manifest': path.resolve(__dirname, 'plugin.json'),
      '@decky/ui': path.resolve(__dirname, 'src/components/deckyUi.tsx'),
      '@decky/api': path.resolve(__dirname, 'src/__mocks__/decky-api.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
  },
});
