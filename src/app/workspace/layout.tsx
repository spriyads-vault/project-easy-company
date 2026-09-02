// UX-04: /workspace joins the shared application shell — the same
// compact left rail every authenticated route now uses (see
// src/lib/design/app-shell.tsx). Zero-fetch pass-through: the rail needs
// no per-page data.
import { AppShell } from "@/lib/design/app-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="workspace">{children}</AppShell>;
}
