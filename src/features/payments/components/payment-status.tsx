import { PaymentStatus } from "@/generated/prisma/client";
import { formatUsd } from "@/lib/money";

export function PaymentStatusView({
  payments,
}: {
  payments: Array<{
    id: string;
    status: PaymentStatus;
    expectedAmountCents: number;
    paypalOrderId: string | null;
    paypalCaptureId: string | null;
  }>;
}) {
  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground">No payments yet.</p>;
  }

  const captured = payments.filter((p) => p.status === PaymentStatus.CAPTURED);
  const open = payments.filter(
    (p) =>
      p.status === PaymentStatus.CREATED || p.status === PaymentStatus.APPROVED,
  );
  const failedCount = payments.filter(
    (p) => p.status === PaymentStatus.FAILED,
  ).length;

  const label = (status: PaymentStatus) => {
    if (status === PaymentStatus.CAPTURED) return "Paid";
    if (status === PaymentStatus.APPROVED) return "Approved — capturing";
    if (status === PaymentStatus.CREATED) return "Checkout started";
    if (status === PaymentStatus.FAILED) return "Checkout abandoned or failed";
    return status;
  };

  const visible = [...captured, ...open];

  return (
    <div className="space-y-2">
      <ul className="space-y-2 text-sm">
        {visible.map((p) => (
          <li key={p.id} className="rounded-md border border-border p-3">
            <p>
              {label(p.status)} · {formatUsd(p.expectedAmountCents)}
            </p>
            {p.paypalOrderId ? (
              <p className="text-xs text-muted-foreground">
                Order {p.paypalOrderId}
              </p>
            ) : null}
            {p.paypalCaptureId ? (
              <p className="text-xs text-muted-foreground">
                Capture {p.paypalCaptureId}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {failedCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          {failedCount} unfinished checkout attempt
          {failedCount === 1 ? "" : "s"} not shown
        </p>
      ) : null}
    </div>
  );
}
