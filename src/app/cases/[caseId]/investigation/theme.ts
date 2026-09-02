// UX-04: this file used to own the case/investigation route's palette
// directly (UX-01/02/03). It now re-exports the app-wide canonical
// tokens (src/lib/design/tokens.ts) instead — "one coherent design
// system" across every authenticated route, not a route that kept its
// own separate theme. Every name/shape below is unchanged from what this
// file used to export directly, so no consumer in this directory needed
// its imports touched, only the values behind them (warm off-white →
// pure white/neutral, per UX-04's explicit "NO yellow/cream tint").
export {
  surface,
  text,
  accent,
  focusRing,
  radius,
  motion,
  evidence,
  heroStatusStyle,
  type HeroStatusTone,
  rail,
  topbar,
  segmented,
  canvasBackground,
  connector,
  artifact,
  type ArtifactKind,
} from "@/lib/design/tokens";
