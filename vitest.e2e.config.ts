import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    setupFiles: ['./src/e2e/setup.ts'],
    include: ['src/e2e/**/*.test.ts'],
    testTimeout: 60000,
  },
});
