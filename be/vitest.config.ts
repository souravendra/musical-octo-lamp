import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 25000,
    hookTimeout: 25000,
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
