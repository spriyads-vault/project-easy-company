// UX-04: Sources pivots from its own dark graphite palette onto the
// canonical light design system (src/lib/design/tokens.ts) — same
// mechanism the investigation workspace's theme.ts already uses. Kept as
// a route-scoped re-export so no import path in this folder needs to
// change.
export { surface, text, accent } from "@/lib/design/tokens";
