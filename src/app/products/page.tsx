// UX-04 (Agent-Native): Products is now its own main rail item — a real
// index page (previously this list only lived inline on /workspace).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listProducts } from "@/lib/products/queries";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { surface, text, typography } from "@/lib/design/tokens";
import { NewProductForm } from "./new-product-form";

export default async function ProductsPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const products = await listProducts();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader eyebrow="Crado" title="Products" />

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto grid w-full max-w-[1000px] gap-6 md:grid-cols-[1fr_360px]">
          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>All products</h2>
            {products.length === 0 ? (
              <EmptyState message="No products yet — create one to open a failure case against it." />
            ) : (
              <ul className="flex flex-col divide-y divide-[#1c212a]">
                {products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="font-medium text-foreground">{product.name}</span>
                      <span className={`shrink-0 ${typography.metadata}`}>
                        {product.revisionCount} {product.revisionCount === 1 ? "revision" : "revisions"}
                        {product.latestRevisionLabel ? (
                          <>
                            {" "}
                            <span className={text.mono}>· {product.latestRevisionLabel}</span>
                          </>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>New product</h2>
            <NewProductForm />
          </section>
        </div>
      </div>
    </div>
  );
}
