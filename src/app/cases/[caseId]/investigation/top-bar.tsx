// TOP BAR (UX-03): the one quiet identity row for a case — replaces both
// the old plain-text breadcrumb header (page.tsx) and case-nav.tsx's
// separate product/revision/case-ref line, so there's a single header row
// instead of two stacked ones. Server-renderable: everything here is a
// Link or a passed-in slot, no client state of its own. The investigation
// page passes `statusPill` and `rightSlot` (the agent status + view
// switcher); the case page passes neither and gets a plain breadcrumb.
import Link from "next/link";
import { text, topbar } from "./theme";

interface TopBarProps {
  caseId: string;
  backHref: string;
  backLabel: string;
  productName: string;
  revisionLabel: string;
  caseTitle: string;
  statusPill?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

/** Presentational shorthand only — derived from the real case id, not a
 * separate stored case-numbering capability (UX-01's original convention,
 * carried over from case-nav.tsx). */
function caseRef(caseId: string): string {
  return `CASE-${caseId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export function TopBar({
  caseId,
  backHref,
  backLabel,
  productName,
  revisionLabel,
  caseTitle,
  statusPill,
  rightSlot,
}: TopBarProps) {
  return (
    <div className={topbar.container}>
      <Link
        href={backHref}
        className={`shrink-0 text-xs ${text.muted} hover:text-foreground hover:underline`}
      >
        ← {backLabel}
      </Link>
      <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
      <p className="min-w-0 truncate text-sm">
        {productName ? <span className="font-medium text-foreground">{productName}</span> : null}
        {revisionLabel ? <span className={text.muted}> · {revisionLabel}</span> : null}
        <span className={text.muted}> · {caseRef(caseId)}</span>
        <span className={text.muted}> · {caseTitle}</span>
      </p>
      {statusPill}
      <div className="ml-auto flex items-center gap-3">{rightSlot}</div>
    </div>
  );
}
