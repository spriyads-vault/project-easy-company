"use client";

// CASE NAVIGATION (UX-02): a quiet identity line — product, revision, case
// reference — plus plain-text tabs. These are four views onto one
// investigation, not four separate pages: switching tabs is local state,
// never a navigation/fetch, so the live SSE-driven `state` this whole
// workspace already tracks stays mounted and connected regardless of which
// tab is showing.
import { nav, text } from "./theme";

export type InvestigationTab = "investigation" | "evidence" | "timeline" | "sources";

const TABS: { id: InvestigationTab; label: string }[] = [
  { id: "investigation", label: "Investigation" },
  { id: "evidence", label: "Evidence" },
  { id: "timeline", label: "Timeline" },
  { id: "sources", label: "Sources" },
];

interface CaseNavProps {
  caseId: string;
  productName: string;
  revisionLabel: string;
  activeTab: InvestigationTab;
  onSelectTab: (tab: InvestigationTab) => void;
}

export function CaseNav({ caseId, productName, revisionLabel, activeTab, onSelectTab }: CaseNavProps) {
  // Presentational shorthand only — derived from the real case id, not a
  // separate stored case-numbering capability, matching UX-01's original
  // caseRef convention (now shown here instead of in the agent header).
  const caseRef = `CASE-${caseId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

  return (
    <div className="flex flex-col gap-1 px-5 pt-4">
      <p className="text-sm">
        {productName ? <span className="font-medium text-[#1c1a15]">{productName}</span> : null}
        {revisionLabel ? <span className={text.muted}> · {revisionLabel}</span> : null}
        <span className={`${text.muted}`}> · {caseRef}</span>
      </p>
      <nav aria-label="Investigation views" className="flex gap-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={activeTab === tab.id ? nav.tabActive : nav.tab}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
