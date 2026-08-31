import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/products/queries";
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
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <div className="flex flex-col gap-1">
        <Link href="/workspace" className="text-xs text-foreground/60 hover:underline">
          ← Workspace
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{product.name}</h1>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Revisions
          </h2>
          {product.revisions.length === 0 ? (
            <p className="text-sm text-foreground/60">No revisions yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {product.revisions.map((revision) => (
                <li key={revision.id}>
                  <Link
                    href={`/products/${product.id}/revisions/${revision.id}`}
                    className="block rounded-md border border-foreground/10 px-3 py-2 text-sm hover:border-foreground/30"
                  >
                    {revision.label}
                    {revision.notes ? (
                      <span className="ml-2 text-foreground/60">
                        {revision.notes}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            New revision
          </h2>
          <NewRevisionForm productId={product.id} />
        </section>
      </div>
    </div>
  );
}
