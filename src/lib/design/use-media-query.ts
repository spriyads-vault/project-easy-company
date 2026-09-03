"use client";

// Shared useSyncExternalStore-backed matchMedia hook — extracted from the
// pattern investigation-workspace.tsx established for UX-04's mobile
// canvas/rail breakpoints, so the Sidebar (and any future consumer) reads
// viewport width the same React-endorsed way: no setState-in-effect (this
// repo's lint config hard-errors on that), no hydration mismatch (SSR has
// no viewport, so the server snapshot always reports "not matched" — the
// widest/most-capable tier — and the real value reconciles after mount).
import { useMemo, useSyncExternalStore } from "react";

function subscribeToMediaQuery(query: string): (onChange: () => void) => () => void {
  return (onChange) => {
    // jsdom (the unit-test environment) does not implement matchMedia —
    // fall back to "never changes" rather than throwing, same as a very
    // old browser without matchMedia support would.
    if (typeof window.matchMedia !== "function") return () => {};
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
}

function getMediaQuerySnapshot(query: string): () => boolean {
  return () => {
    if (typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  };
}

function getMediaQueryServerSnapshot(): boolean {
  return false;
}

export function useMediaQuery(query: string): boolean {
  const subscribe = useMemo(() => subscribeToMediaQuery(query), [query]);
  const getSnapshot = useMemo(() => getMediaQuerySnapshot(query), [query]);
  return useSyncExternalStore(subscribe, getSnapshot, getMediaQueryServerSnapshot);
}
