import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(root, ".env") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      AI_PROVIDER: process.env.AI_PROVIDER_FOR_TESTS ?? "manual",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(root, "./src"),
      "server-only": path.resolve(root, "./tests/shims/server-only.ts"),
    },
  },
});
