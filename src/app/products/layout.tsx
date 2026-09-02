// UX-04 (Agent-Native): /products is now its own main rail item — the
// product/revision index and detail pages join the shared application
// shell with "products" marked current.
import { AppShell } from "@/lib/design/app-shell";

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell active="products">{children}</AppShell>;
}
