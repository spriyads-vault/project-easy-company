import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listCasesAvailableForBenchmark } from "@/lib/benchmarks/queries";
import { NewBenchmarkForm } from "./new-benchmark-form";

export default async function NewBenchmarkPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const cases = await listCasesAvailableForBenchmark();

  return (
    <div className="flex flex-1 flex-col gap-6 px-8 py-10 text-foreground">
      <header className="flex flex-col gap-1 border-b border-foreground/10 pb-4">
        <Link href="/benchmarks" className="text-sm text-foreground/60 hover:text-foreground">
          ← Benchmarks
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">
          Register a historical benchmark case
        </h1>
      </header>

      <div className="max-w-2xl">
        <NewBenchmarkForm cases={cases} />
      </div>
    </div>
  );
}
