// UX-04 (Agent-Native): Investigations is the new default landing
// experience — its own main rail item.
import { AppShell } from "@/lib/design/app-shell";

export default function InvestigationsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="investigations">{children}</AppShell>;
}
