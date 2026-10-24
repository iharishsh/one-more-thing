import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell } from "@/components/page-shell";
import { ClientRequestForm } from "@/features/intake/components/client-request-form";
import { getIntakeProject } from "@/features/intake/intake.service";

export default async function ClientRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const project = await getIntakeProject(token);
  if (!project) notFound();

  return (
    <PageShell className="bg-white">
      <AppHeader variant="client" />
      <PageMain className="max-w-xl space-y-6">
        <section className="space-y-2">
          <p className="eyebrow">Send a request</p>
          <h1 className="text-heading">{project.title}</h1>
          <p className="text-sm tracking-body text-muted-foreground">
            Ask for a change or something new. Your freelancer will check it
            against what you agreed and get back to you, either confirming
            it&apos;s included or with a price to approve.
          </p>
        </section>
        <section className="surface-card p-5 md:p-6">
          <ClientRequestForm token={token} />
        </section>
      </PageMain>
    </PageShell>
  );
}
