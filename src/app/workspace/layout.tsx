import { AuthTransitionSettler } from "@/components/auth-transition-settler";

/** Settler lives here so nested workspace routes lift the auth overlay too. */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthTransitionSettler />
      {children}
    </>
  );
}
