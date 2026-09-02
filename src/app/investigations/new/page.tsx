// NEW INVESTIGATION INTAKE (UX-04 Agent-Native): "What happened?" — a
// full page, not a modal, deliberately: file drag/drop and a mobile
// composer both work better with real screen real estate and a real,
// refresh-safe URL than a shadcn Dialog would (see
// docs/UX_AGENT_NATIVE.md §8).
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listProducts } from "@/lib/products/queries";
import { PageHeader } from "@/lib/design/page-header";
import { surface } from "@/lib/design/tokens";
import { IntakeComposer } from "./intake-composer";

export default async function NewInvestigationPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const products = await listProducts();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader backHref="/investigations" backLabel="Investigations" title="New investigation" />
      <div className="flex flex-1 flex-col overflow-y-auto px-4 py-8 sm:px-6 sm:py-12">
        <IntakeComposer products={products.map((product) => ({ id: product.id, name: product.name }))} />
      </div>
    </div>
  );
}
