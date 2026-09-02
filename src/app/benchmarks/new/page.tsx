import { redirect } from "next/navigation";
import { getCurrentWorkspace } from "@/lib/workspace/get-current-workspace";
import { listCasesAvailableForBenchmark } from "@/lib/benchmarks/queries";
import { NewBenchmarkForm } from "./new-benchmark-form";
import { PageHeader } from "@/lib/design/page-header";
import { surface } from "@/lib/design/tokens";

export default async function NewBenchmarkPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) {
    redirect("/login");
  }

  const cases = await listCasesAvailableForBenchmark();

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${surface.page}`}>
      <PageHeader
        backHref="/benchmarks"
        backLabel="Benchmarks"
        title="Register a historical benchmark case"
      />

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
        <div className="mx-auto w-full max-w-2xl">
          <NewBenchmarkForm cases={cases} />
        </div>
      </div>
    </div>
  );
}
