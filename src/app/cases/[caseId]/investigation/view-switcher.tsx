"use client";

// VIEW SWITCHER (UX-03, replaces case-nav.tsx's underlined tab row): a
// compact segmented control in the top bar — Investigation / Evidence /
// Timeline / Sources are alternate views of one investigation, not four
// separate pages. Switching is still local state, never a
// navigation/fetch, so the live SSE-driven workspace state stays mounted
// and connected regardless of which view is showing — same contract
// case-nav.tsx had, new shape.
import { segmented } from "./theme";

export type InvestigationTab = "decision" | "investigation" | "evidence" | "timeline" | "sources";

// UX-05: Decision is the new default/first tab — the failure-first,
// decision-first read (measurement, known facts, leading hypotheses,
// recommended next test, outcome) with zero graph navigation required.
// "Investigation" (the React Flow canvas) stays as the secondary Map view
// for engineers who want the topology, unchanged from UX-04.
const TABS: { id: InvestigationTab; label: string }[] = [
  { id: "decision", label: "Decision" },
  { id: "investigation", label: "Map" },
  { id: "evidence", label: "Evidence" },
  { id: "timeline", label: "Timeline" },
  { id: "sources", label: "Sources" },
];

interface ViewSwitcherProps {
  activeTab: InvestigationTab;
  onSelectTab: (tab: InvestigationTab) => void;
}

export function ViewSwitcher({ activeTab, onSelectTab }: ViewSwitcherProps) {
  return (
    <nav aria-label="Investigation views" className={segmented.container}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelectTab(tab.id)}
          aria-current={activeTab === tab.id ? "page" : undefined}
          className={activeTab === tab.id ? segmented.itemActive : segmented.item}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
