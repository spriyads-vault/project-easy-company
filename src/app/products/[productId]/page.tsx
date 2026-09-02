import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products/queries";
import { PageHeader } from "@/lib/design/page-header";
import { EmptyState } from "@/lib/design/empty-state";
import { surface, typography } from "@/lib/design/tokens";
import { NewRevisionForm } from "./new-revision-form";

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { productId } = await params;
  const product = await getProduct(productId);
  if (!product) {
    notFound();
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader backHref="/workspace" backLabel="Workspace" title={product.name} />

      <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto grid w-full max-w-[1000px] gap-6 md:grid-cols-2">
          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>Revisions</h2>
            {product.revisions.length === 0 ? (
              <EmptyState message="No revisions yet." />
            ) : (
              <ul className="flex flex-col gap-2">
                {product.revisions.map((revision) => (
                  <li key={revision.id}>
                    <Link
                      href={`/products/${product.id}/revisions/${revision.id}`}
                      className="flex flex-col gap-0.5 rounded-xl border border-[#ececee] px-3 py-2 text-sm transition-colors hover:border-[#d4d4d8] hover:bg-[#f4f4f5]/60"
                    >
                      <span className="font-medium text-[#18181b]">{revision.label}</span>
                      {revision.notes ? (
                        <span className={typography.metadata}>{revision.notes}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <h2 className={typography.sectionHeading}>New revision</h2>
            <NewRevisionForm productId={product.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
