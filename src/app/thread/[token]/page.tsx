import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageMain, PageShell } from "@/components/page-shell";
import { ClientThreadPanel } from "@/features/agent/components/client-thread-panel";
import { getClientThreadByToken } from "@/features/agent/agent.service";

export default async function ChangeThreadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const view = await getClientThreadByToken(token);

  if (view.state === "missing") notFound();

  if (view.state === "revoked") {
    return (
      <PageShell className="bg-white">
        <AppHeader variant="client" />
        <PageMain className="max-w-lg space-y-4">
          <p className="eyebrow">Change thread</p>
          <div className="surface-card space-y-3 p-6">
            <h1 className="text-heading">Invitation withdrawn</h1>
            <p className="text-sm text-muted-foreground">
              This clarification link is no longer valid. Ask the freelancer for
              a new invite if you still need to answer.
            </p>
          </div>
        </PageMain>
      </PageShell>
    );
  }

  return (
    <PageShell className="bg-white">
      <AppHeader variant="client" />
      <PageMain className="max-w-lg space-y-4">
        <p className="eyebrow">Change thread</p>
        <h1 className="text-heading">{view.projectTitle}</h1>
        <p className="text-sm text-muted-foreground">
          Answer clarifications here. Private pricing notes stay with your
          freelancer.
        </p>
        <ClientThreadPanel
          token={token}
          initialMessages={view.messages}
          waitingForAnswer={view.waitingForAnswer}
        />
      </PageMain>
    </PageShell>
  );
}
