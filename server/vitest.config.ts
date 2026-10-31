import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Some tests start a node process or a whole database in this one; 5 s is not enough when the machine is busy.
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30_000 },
});
