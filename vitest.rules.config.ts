import { defineConfig } from 'vitest/config';

// Firestore rules tests; they need the emulator (npm run test:rules starts it).
export default defineConfig({
  test: { include: ['rules/**/*.test.ts'], environment: 'node', testTimeout: 20000, fileParallelism: false },
});
