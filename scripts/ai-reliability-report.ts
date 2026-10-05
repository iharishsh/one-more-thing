/**
 * Thin wrapper — prefer:
 *   AI_PROVIDER_FOR_TESTS=hosted HOSTED_AI_CHAIN=groq RUN_AI_RELIABILITY=1 \\
 *     pnpm exec vitest run tests/ai-reliability.live.test.ts
 */
import { spawnSync } from "node:child_process";

const env = {
  ...process.env,
  AI_PROVIDER: process.env.AI_PROVIDER ?? "hosted",
  AI_PROVIDER_FOR_TESTS: process.env.AI_PROVIDER_FOR_TESTS ?? "hosted",
  HOSTED_AI_CHAIN: process.env.HOSTED_AI_CHAIN ?? "groq",
  RUN_AI_RELIABILITY: "1",
};

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "tests/ai-reliability.live.test.ts"],
  { env, stdio: "inherit", shell: true },
);
process.exit(result.status ?? 1);
