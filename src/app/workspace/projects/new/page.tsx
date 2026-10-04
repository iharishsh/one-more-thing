import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import {
  PageHeader,
  PageMain,
  PageShell,
} from "@/components/page-shell";
import { NewProjectForm } from "@/features/projects/components/new-project-form";

export default function NewProjectPage() {
  return (
    <PageShell>
      <AppHeader />
      <PageMain className="max-w-3xl">
        <div className="mb-6 space-y-2">
          <Link
            href="/workspace"
            className="text-sm text-[color:var(--brand)] no-underline"
          >
            ← Workspace
          </Link>
          <PageHeader
            title="New project"
            description="Capture the original agreement before the client asks for one more thing."
          />
        </div>
        <div className="surface-card p-5 md:p-6">
          <NewProjectForm />
        </div>
      </PageMain>
    </PageShell>
  );
}
