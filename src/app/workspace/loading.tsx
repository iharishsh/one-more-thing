import { WorkspaceGhost } from "@/components/workspace-ghost";

/**
 * Keeps the workspace chrome on screen while the route streams in — critical
 * for auth→workspace so the handoff never flashes a blank page.
 */
export default function WorkspaceLoading() {
  return <WorkspaceGhost />;
}
