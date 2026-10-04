import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/page-shell";
import { OperationsGrid } from "@/features/operations/components/operations-grid";
import { listOperationsRows } from "@/features/operations/operations.service";
import { requireFreelancer } from "@/server/auth";

export default async function OperationsPage() {
  const user = await requireFreelancer();
  const rows = await listOperationsRows(user.id);

  return (
    <PageShell>
      <AppHeader />
      <PageMain>
        <div className="mb-6 space-y-3">
          <Link
            href="/workspace"
            className="text-sm text-[color:var(--brand)] no-underline"
          >
            ← Workspace
          </Link>
          <PageHeader
            title="Changes & Payments"
            description="Filter requests by finding, agreement, or payment status. Open a row to review evidence."
          />
        </div>
        <OperationsGrid rows={rows} />
      </PageMain>
    </PageShell>
  );
}
