import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell } from "@/components/page-shell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <PageShell>
      <AppHeader variant="marketing" />
      <PageMain className="flex max-w-xl flex-col items-start gap-4 py-20">
        <h1 className="text-heading">Page not found</h1>
        <p className="text-muted-foreground">
          That link doesn’t match anything in this demo workspace.
        </p>
        <Link
          href="/workspace"
          className={cn(buttonVariants({ variant: "brand" }), "no-underline")}
        >
          Open workspace
        </Link>
      </PageMain>
    </PageShell>
  );
}
