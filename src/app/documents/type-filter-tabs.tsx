// The Sources page's type filter — plain links (not client state), so
// filtering, pagination, and direct URLs all compose correctly with no
// client JS required to render the filtered list itself.
import Link from "next/link";
import { text } from "./theme";

const TABS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "product", label: "Product" },
  { value: "testing", label: "Testing" },
  { value: "regulatory", label: "Regulatory" },
  { value: "datasheets", label: "Datasheets" },
  { value: "notes", label: "Notes" },
];

interface TypeFilterTabsProps {
  active: string | null;
}

export function TypeFilterTabs({ active }: TypeFilterTabsProps) {
  return (
    <nav aria-label="Filter sources by type" className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const isActive = tab.value === active;
        return (
          <Link
            key={tab.label}
            href={tab.value ? `/documents?type=${tab.value}` : "/documents"}
            aria-current={isActive ? "true" : undefined}
            className={
              isActive
                ? "border border-[#3ecf6e]/60 bg-[#3ecf6e]/10 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-[#5fdb87]"
                : `border border-[#2c2f27] px-3 py-1.5 text-xs uppercase tracking-wide ${text.muted} hover:border-[#3a3d34] hover:text-[#f3f1e8]`
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
