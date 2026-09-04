"use client";

// THEME PROVIDER (Enterprise Investigation UI Revamp, Section 1): tracks
// the user's Light/Dark/System choice, persists it, and stamps
// data-theme on <html> — the single source every globals.css block keys
// off. Hand-rolled rather than pulling in next-themes: the whole
// contract is small and this repo already has an established, lint-safe
// pattern for exactly this class of problem — reading an external,
// possibly-absent-on-the-server value without a hydration mismatch —
// via useSyncExternalStore (see src/lib/design/use-media-query.ts,
// which this file reuses directly for the "System" branch rather than
// re-deriving it). A plain useState+useEffect("read localStorage, then
// setState") was tried first and rejected: this repo's lint config
// hard-errors on setState called synchronously inside an effect
// (react-hooks/set-state-in-effect) precisely because it causes the
// extra render/cascading-update pattern useSyncExternalStore exists to
// avoid.
//
// Anti-hydration-flash: THEME_INIT_SCRIPT (exported so layout.tsx can
// inline it into <head> as a blocking script, same technique
// next-themes/every theme-aware framework uses) reads localStorage and
// applies data-theme to <html> before React hydrates or first paint —
// without it, the server always renders no data-theme attribute (light,
// or whatever the OS says), and a returning dark-mode user would see a
// one-frame flash of the wrong theme. That script sets the DOM attribute
// outside React's tracking (safe — RootLayout never claims ownership of
// data-theme, and <html> carries suppressHydrationWarning for this exact
// reason); this file's own state (used only to drive the theme-menu UI)
// is synced separately, via useSyncExternalStore below.
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useMediaQuery } from "./use-media-query";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "crado.theme";

// Executed as a raw string inside a <script> tag in the document head —
// see src/app/layout.tsx. Deliberately tiny and dependency-free (no
// access to any module scope at that point in the document).
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();`;

function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage can throw in private-browsing/locked-down contexts —
    // "system" (the honest default) is always safe to fall back to.
  }
  return "system";
}

// A tiny useSyncExternalStore-compatible store over localStorage: React
// itself has no built-in subscription for storage, so setChoice()
// notifies these listeners directly (same-tab writes) while the native
// `storage` event covers other tabs.
const listeners = new Set<() => void>();

function subscribeToStoredChoice(onChange: () => void): () => void {
  listeners.add(onChange);
  function onStorageEvent(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  }
  if (typeof window !== "undefined") window.addEventListener("storage", onStorageEvent);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorageEvent);
  };
}

function getStoredChoiceSnapshot(): ThemeChoice {
  return readStoredChoice();
}

// No localStorage on the server — "system" is the honest, safe default
// (matches THEME_INIT_SCRIPT's own "do nothing, let prefers-color-scheme
// decide" behavior when nothing is stored).
function getStoredChoiceServerSnapshot(): ThemeChoice {
  return "system";
}

interface ThemeContextValue {
  /** The user's explicit choice, including "system". */
  choice: ThemeChoice;
  /** What's actually rendered right now — "system" always resolves to
   * one of these before this is read. */
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

// The safe, inert default returned by useTheme() outside a ThemeProvider —
// deliberately NOT a thrown error. src/app/layout.tsx always mounts a real
// ThemeProvider for the actual app, but plenty of unit tests render a
// single component (InvestigationCanvas, AppShellChrome, ...) in
// isolation without the full app tree; requiring every such test to add
// a wrapper just so a Map-view color-scheme prop resolves would be
// churn for no product value. "light" is a perfectly valid resolved
// theme in that context, and setChoice is a harmless no-op.
const FALLBACK_THEME_CONTEXT: ThemeContextValue = {
  choice: "light",
  resolved: "light",
  setChoice: () => {},
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context ?? FALLBACK_THEME_CONTEXT;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const choice = useSyncExternalStore(
    subscribeToStoredChoice,
    getStoredChoiceSnapshot,
    getStoredChoiceServerSnapshot,
  );
  // Reuses the exact hook the sidebar/canvas breakpoints already use —
  // one hydration-safe matchMedia pattern for the whole app, not a
  // second bespoke one just for color-scheme.
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved: ResolvedTheme = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  function setChoice(next: ThemeChoice) {
    try {
      if (next === "system") {
        window.localStorage.removeItem(STORAGE_KEY);
      } else {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
    } catch {
      // Non-persistable environments (private browsing, storage
      // disabled): still apply the in-session choice below.
    }
    // Same-tab listener notification — the native `storage` event only
    // fires in *other* tabs/windows, never the one that made the write.
    for (const listener of listeners) listener();
    // Keeps <html data-theme> in sync immediately (not via an effect —
    // this is a direct response to a user action, exactly like any other
    // DOM-touching event handler in this codebase, not "synchronizing
    // with an external system" on every render). THEME_INIT_SCRIPT
    // already did the equivalent job for the very first paint;
    // "system" removes the attribute entirely so globals.css's
    // prefers-color-scheme block alone decides.
    const root = document.documentElement;
    root.classList.add("crado-theme-transition");
    if (next === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", next);
    }
    window.setTimeout(() => root.classList.remove("crado-theme-transition"), 220);
  }

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
