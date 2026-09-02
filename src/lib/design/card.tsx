// CARD (UX-04): "cards should have different visual importance — do not
// make every object look identical." Three variants sharing one surface
// vocabulary:
//   - primary: the main artifact on a page (soft shadow, full radius)
//   - secondary: a support surface next to it (quieter fill, no shadow)
//   - tertiary: inline metadata (no card chrome at all, just a hairline)
// A thin wrapper over the `surface`/`radius` tokens, not a new styling
// system — every page could write these classes by hand; this just keeps
// the three variants consistent everywhere they're used.
import { radius, surface } from "./tokens";

export type CardVariant = "primary" | "secondary" | "tertiary";

const VARIANT_CLASS: Record<CardVariant, string> = {
  primary: surface.card,
  secondary: `${radius.card} border border-[#e4e4e7] bg-white`,
  tertiary: "border-t border-[#ececee] pt-3",
};

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: React.ReactNode;
}

export function Card({ variant = "primary", className = "", children }: CardProps) {
  return <div className={`${VARIANT_CLASS[variant]} ${className}`.trim()}>{children}</div>;
}
