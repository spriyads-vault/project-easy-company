import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listProducts } from "@/lib/products/queries";
import { signOut } from "./actions";
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
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <header className="flex items-center justify-between border-b border-foreground/10 pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/50">
            Crado
          </p>
          <h1 className="text-lg font-semibold tracking-tight">
            {workspace.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium"
          >
            Sources
          </Link>
          <Link
            href="/benchmarks"
            className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium"
          >
            Benchmarks
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm font-medium"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            Products
          </h2>
          {products.length === 0 ? (
            <p className="text-sm text-foreground/60">No products yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {products.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    className="block rounded-md border border-foreground/10 px-3 py-2 text-sm hover:border-foreground/30"
                  >
                    {product.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-foreground/50">
            New product
          </h2>
          <NewProductForm />
        </section>
      </div>
    </div>
  );
}
