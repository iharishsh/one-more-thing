import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/page-shell";
import { ActivityGrid } from "@/features/activity/components/activity-grid";
import { listActivityRows } from "@/features/activity/activity.service";
import { requireFreelancer } from "@/server/auth";

export default async function ActivityPage() {
  const user = await requireFreelancer();
  const rows = await listActivityRows(user.id);

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
            title="Activity"
            description="Filter and sort workspace history. Click a row to open the related project or request. For payments and scope status, use Changes & Payments."
            actions={
              <Link
                href="/workspace/operations"
                className="text-sm font-medium text-[color:var(--brand)] no-underline hover:text-[color:var(--brand-bright)]"
              >
                Changes &amp; Payments →
              </Link>
            }
          />
        </div>
        <ActivityGrid rows={rows} />
      </PageMain>
    </PageShell>
  );
}
