// PAGE HEADER (UX-04): the quiet top-bar shape shared by every
// non-investigation authenticated page (workspace, products, documents,
// benchmarks) — a back link, a breadcrumb-style identity line, an
// optional page title, and a right-aligned actions slot. The
// investigation route keeps its own richer top-bar.tsx (agent-status
// pill + view switcher) since it needs slots this one doesn't, but both
// draw from the same `topbar`/`typography` tokens so they read as the
// same header, just with different contents.
import Link from "next/link";
import { text, topbar, typography } from "./tokens";

interface PageHeaderProps {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  title: string;
  rightSlot?: React.ReactNode;
}

export function PageHeader({ backHref, backLabel, eyebrow, title, rightSlot }: PageHeaderProps) {
  return (
    <div className={topbar.container}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {backHref && backLabel ? (
          <Link href={backHref} className={`text-xs ${text.muted} hover:text-[#18181b] hover:underline`}>
            ← {backLabel}
          </Link>
        ) : eyebrow ? (
          <span className={text.kicker}>{eyebrow}</span>
        ) : null}
        <h1 className={`truncate ${typography.pageTitle}`}>{title}</h1>
      </div>
      {rightSlot ? <div className="flex shrink-0 items-center gap-3">{rightSlot}</div> : null}
    </div>
  );
}
