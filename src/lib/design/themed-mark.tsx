"use client";

// Auth enterprise redesign: the auth context pane sits directly on
// --card/--background, which actually flips light/white <-> dark/near-
// black between themes (unlike the sidebar, which stays a dark-ish
// surface in both themes and so always uses the white mark). Picks the
// real monochrome logo asset — public/brand/crado-mark-{white,black}.png,
// verified pure black-on-transparent / white-on-transparent, see
// globals.css's --primary comment — that's actually legible on the
// resolved surface. useTheme() is the same hydration-safe
// useSyncExternalStore-backed hook every other theme-aware piece of the
// app already reads; the one-frame swap from the server-snapshot default
// to the real persisted choice after mount is the established, accepted
// pattern here, not a new risk.
import Image from "next/image";
import { useTheme } from "./theme-provider";

interface ThemedMarkProps {
  width: number;
  height: number;
  className?: string;
}

export function ThemedMark({ width, height, className }: ThemedMarkProps) {
  const { resolved } = useTheme();
  const src = resolved === "dark" ? "/brand/crado-mark-white.png" : "/brand/crado-mark-black.png";
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      priority
      // Tailwind's Preflight resets img{height:auto}, which fights the
      // explicit height prop above and makes next/image log a "width or
      // height modified, but not the other" warning. Pinning both as
      // literal-pixel utility classes (which the base layer resets are
      // wilfully overridden by) keeps the real intrinsic aspect ratio.
      style={{ width, height }}
      className={className}
    />
  );
}
