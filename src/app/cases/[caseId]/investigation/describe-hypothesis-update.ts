// Shared display strings/styling for a hypothesis-update status (MVP-11) —
// used by both hypothesis-card.tsx (the badge on a live hypothesis) and
// investigation-timeline.tsx (the timeline's "Updated investigation" step),
// so the two surfaces can never drift into inconsistent wording.
import type { HypothesisUpdateStatus } from "@/lib/domain/schema";

export const HYPOTHESIS_UPDATE_LABEL: Record<HypothesisUpdateStatus, string> = {
  supported_by_new_evidence: "Supported by new evidence",
  weakened_by_new_evidence: "Weakened by new evidence",
  unchanged: "Unchanged",
  needs_more_evidence: "Needs more evidence",
};

// Deliberately qualitative-only styling (green/warn/neutral/dashed) — never
// a percentage, score, or probability bar. See docs/PROGRESS.md's MVP-11
// entry for why no Bayesian/probability update is implemented.
export const HYPOTHESIS_UPDATE_STYLE: Record<HypothesisUpdateStatus, string> = {
  supported_by_new_evidence: "border-[#1f9d52]/50 bg-[#1f9d52]/10 text-[#15803d]",
  weakened_by_new_evidence: "border-[#b45309]/50 bg-[#b45309]/10 text-[#b45309]",
  unchanged: "border-[#d4d4d8] text-[#71717a]",
  needs_more_evidence: "border-dashed border-[#d4d4d8] text-[#71717a]",
};
