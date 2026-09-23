import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    setupFiles: ['./tests/helpers/setup-env.js'],
    include: [
      'tests/unit/**/*.test.js',
      'tests/integration/**/*.test.js',
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'apps/**',
      'dist/**',
    ],
    globals: true,
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportOnFailure: true,
      include: ['src/**'],
      exclude: ['src/services/webllm-loader.js', 'src/services/user-api.js'],
    },
  },
});
