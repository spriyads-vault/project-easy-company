// UX-04: /products (product detail, revision detail) joins the shared
// application shell. Reached from Workspace and conceptually part of it,
// so the rail marks "workspace" as current here too.
import { AppShell } from "@/lib/design/app-shell";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="workspace">{children}</AppShell>;
}
