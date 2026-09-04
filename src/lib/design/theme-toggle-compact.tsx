"use client";

// Auth enterprise redesign: a single-control theme switch for the auth
// pane's top-right utility area — the sidebar's full 3-way Light/Dark/
// System segmented control (app-shell-chrome.tsx's ThemeMenuControl)
// lives inside a dropdown menu that doesn't exist pre-auth, and building
// one just for this one row would be disproportionate. Cycles
// light -> dark -> system -> light; the icon always reflects what's
// actually resolved right now, and the accessible name states the
// action a click performs (not just the current state), per the
// ticket's "keyboard accessible and announces its state" requirement.
import { Monitor, Moon, Sun } from "lucide-react";
import { focusRing } from "./tokens";
import { useTheme, type ThemeChoice } from "./theme-provider";

const NEXT_CHOICE: Record<ThemeChoice, ThemeChoice> = {
  light: "dark",
  dark: "system",
  system: "light",
};

const ICON = { light: Sun, dark: Moon, system: Monitor } as const;
const LABEL = { light: "light", dark: "dark", system: "system" } as const;

export function ThemeToggleCompact() {
  const { choice, setChoice } = useTheme();
  const Icon = ICON[choice];
  const next = NEXT_CHOICE[choice];

  return (
    <button
      type="button"
      onClick={() => setChoice(next)}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]} theme.`}
      title={`Theme: ${LABEL[choice]}`}
      className={`flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${focusRing}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
