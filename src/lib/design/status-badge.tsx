// STATUS BADGE (UX-04): one small pill component for every "state of a
// thing" label in the product — document indexing status, benchmark case
// status, engineering-change/revision status. Tone maps to the same
// restrained vocabulary as heroStatusStyle (theme.ts) so a status reads
// consistently whether it's an agent run or a document upload.
import { heroStatusStyle, type HeroStatusTone } from "./tokens";

interface StatusBadgeProps {
  label: string;
  tone?: HeroStatusTone;
}

export function StatusBadge({ label, tone = "idle" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${heroStatusStyle[tone]}`}
    >
      {tone === "active" ? (
        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#1f9d52]" />
      ) : null}
      {label}
    </span>
  );
}
