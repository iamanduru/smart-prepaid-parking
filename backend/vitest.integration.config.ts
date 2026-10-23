import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    include: [
      "src/**/*.integration.test.ts",
    ],

    setupFiles: [
      "./src/test/setup-env.ts",
    ],

    env: {
      NODE_ENV: "test",
    },

    /*
     * Integration tests share one isolated
     * PostgreSQL schema, so run them with
     * a single worker.
     */
    maxWorkers: 1,
  },
});