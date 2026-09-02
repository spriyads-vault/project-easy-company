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
                ? "rounded-full border border-[#1f9d52]/50 bg-[#1f9d52]/10 px-3 py-1.5 text-xs font-medium text-[#15803d]"
                : `rounded-full border border-[#e4e4e7] px-3 py-1.5 text-xs font-medium ${text.muted} transition-colors hover:border-[#d4d4d8] hover:text-[#18181b]`
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
