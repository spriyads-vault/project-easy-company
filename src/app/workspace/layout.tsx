// UX-04 (Agent-Native): /workspace is the real "Workspace" account page,
// reached from the sidebar's account menu — not a main rail item (that's
// now Investigations/Products/Sources/Benchmarks), so no `active` is
// passed, the same precedent cases/[caseId]/layout.tsx already set for a
// route the rail doesn't represent.
import { AppShell } from "@/lib/design/app-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
