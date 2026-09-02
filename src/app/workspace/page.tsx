import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listProducts } from "@/lib/products/queries";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { surface, text, typography } from "@/lib/design/tokens";
import { NewProductForm } from "./new-product-form";

export default async function WorkspacePage() {
  const workspace = await getCurrentWorkspace();

  // Defense in depth: middleware already redirects unauthenticated
  // requests, but a page that can render private data should never trust
  // that alone.
  if (!workspace) {
    redirect("/login");
  }

  const products = await listProducts();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader eyebrow="Crado" title={workspace.name} />

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto grid w-full max-w-[1000px] gap-6 md:grid-cols-[1fr_360px]">
          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>Products</h2>
            {products.length === 0 ? (
              <EmptyState message="No products yet — create one to open a failure case against it." />
            ) : (
              <ul className="flex flex-col divide-y divide-[#ececee]">
                {products.map((product) => (
                  <li key={product.id}>
                    <Link
                      href={`/products/${product.id}`}
                      className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-[#15803d]"
                    >
                      <span className="font-medium text-[#18181b]">{product.name}</span>
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
