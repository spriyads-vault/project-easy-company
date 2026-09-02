// UX-04: Benchmarks joins the shared application shell, rail marked
// current. Still an internal evaluation tool, not part of the
// customer-facing demo flow — but it now shares the same visual system as
// every other authenticated route rather than a bare admin-table look.
import { AppShell } from "@/lib/design/app-shell";

export default function BenchmarksLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="benchmarks">{children}</AppShell>;
}
