/**
 * Payment / webhook helper scripts must never run against live PayPal credentials.
 */
export function assertSandboxPaypalMode(scriptName: string) {
  const mode = (process.env.PAYPAL_MODE ?? "sandbox").trim().toLowerCase();
  if (mode === "live") {
    console.error(
      `[${scriptName}] Refusing to run: PAYPAL_MODE=live. These helpers are sandbox-only.`,
    );
    process.exit(1);
  }
}
