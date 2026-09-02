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
  supported_by_new_evidence: "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#22c55e]",
  weakened_by_new_evidence: "border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#f59e0b]",
  unchanged: "border-[#2d3440] text-[#9aa3af]",
  needs_more_evidence: "border-dashed border-[#2d3440] text-[#9aa3af]",
};
