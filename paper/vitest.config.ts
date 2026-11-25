import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/**/*.test.ts', 'tools/**/*.test.ts', 'app/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
