import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [[/client\.test\.[tj]sx$/, "jsdom"]],
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reports: ["text", "lcov"],
    },
  },
});
