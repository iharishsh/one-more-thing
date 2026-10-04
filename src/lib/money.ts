export function centsToUsd(cents: number) {
  return (cents / 100).toFixed(2);
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function assertSameMoney(
  expectedCents: number,
  actual: string,
  currency: string,
) {
  if (currency !== "USD") {
    throw new Error("Only USD is supported in the demo");
  }
  const actualCents = Math.round(Number(actual) * 100);
  if (actualCents !== expectedCents) {
    throw new Error(
      `Amount mismatch: expected ${expectedCents}, got ${actualCents}`,
    );
  }
}
