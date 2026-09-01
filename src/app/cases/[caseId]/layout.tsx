// UX-03: the application shell (compact left rail) wraps the whole case
// route family — both /cases/[caseId] (measurements) and
// /cases/[caseId]/investigation — via Next.js's normal shared-layout
// mechanism, rather than importing AppShell separately in each page. The
// rail itself needs no per-case data (see app-shell.tsx), so this stays a
// zero-fetch pass-through.
import { AppShell } from "./investigation/app-shell";

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
