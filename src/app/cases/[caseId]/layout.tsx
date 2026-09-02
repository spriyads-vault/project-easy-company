// UX-03/04: the application shell (compact left rail) wraps the whole
// case route family — both /cases/[caseId] (measurements) and
// /cases/[caseId]/investigation — via Next.js's normal shared-layout
// mechanism. UX-04 promoted AppShell to the app-wide
// src/lib/design/app-shell.tsx (every authenticated route now shares the
// same rail); no `active` rail section is passed here since a case page
// is reached *from* Workspace but isn't Workspace itself — none of the
// three rail items represent it.
import { AppShell } from "@/lib/design/app-shell";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
