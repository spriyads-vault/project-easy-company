// UX-04: Sources joins the shared application shell, rail marked current.
import { AppShell } from "@/lib/design/app-shell";

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="sources">{children}</AppShell>;
}
