// Enterprise Investigation UI Revamp, Section 1/10: proves the theme
// system's real contract — persistence, System following the OS
// preference live, an explicit choice pinning regardless of the OS, and
// that useTheme() never throws outside a provider (many existing tests
// render a single component without the full app tree — see the
// "outside a ThemeProvider" describe block).
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme, THEME_INIT_SCRIPT, type ThemeChoice } from "./theme-provider";

// A minimal, controllable matchMedia mock — jsdom implements none of
// this natively. Only "(prefers-color-scheme: dark)" is modeled; the
// listener registry lets a test simulate a live OS preference change.
function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mql = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    setSystemDark(next: boolean) {
      matches = next;
      for (const listener of listeners) listener({ matches: next } as MediaQueryListEvent);
    },
  };
}

function Probe() {
  const { choice, resolved, setChoice } = useTheme();
  return (
    <div>
      <span data-testid="choice">{choice}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setChoice("dark")}>set dark</button>
      <button onClick={() => setChoice("light")}>set light</button>
      <button onClick={() => setChoice("system")}>set system</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("defaults to system/light when nothing is stored and the OS has no dark preference", () => {
    installMatchMediaMock(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("choice")).toHaveTextContent("system");
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("System follows a live OS preference change without a page reload", () => {
    const os = installMatchMediaMock(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    act(() => os.setSystemDark(true));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");

    act(() => os.setSystemDark(false));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("an explicit Dark choice pins regardless of the OS preference", () => {
    const os = installMatchMediaMock(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText("set dark").click());
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // The OS "returning to light" must not un-pin an explicit choice —
    // that's exactly what distinguishes "Dark" from "System".
    act(() => os.setSystemDark(false));
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("an explicit Light choice pins even when the OS prefers dark", () => {
    installMatchMediaMock(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText("set light").click());
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("persists the explicit choice to localStorage and a remount reads it back", () => {
    installMatchMediaMock(false);
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText("set dark").click());
    expect(window.localStorage.getItem("crado.theme")).toBe("dark");
    unmount();

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("choice")).toHaveTextContent("dark");
    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it('returning to "system" clears the persisted override', () => {
    installMatchMediaMock(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    act(() => screen.getByText("set dark").click());
    expect(window.localStorage.getItem("crado.theme")).toBe("dark");

    act(() => screen.getByText("set system").click());
    expect(window.localStorage.getItem("crado.theme")).toBeNull();
    expect(screen.getByTestId("choice")).toHaveTextContent("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("ignores a corrupted/unrecognized stored value instead of throwing", () => {
    installMatchMediaMock(false);
    window.localStorage.setItem("crado.theme", "sepia");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("choice")).toHaveTextContent("system");
  });

  it("THEME_INIT_SCRIPT (the anti-flash blocking script) only ever applies a recognized light/dark value", () => {
    // Simulates the blocking <script> layout.tsx inlines, without a real
    // browser — proves it degrades safely rather than stamping an
    // arbitrary stored string onto <html>.
    window.localStorage.setItem("crado.theme", "not-a-real-theme");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    window.localStorage.setItem("crado.theme", "dark");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });
});

describe("useTheme outside a ThemeProvider", () => {
  it("returns a safe light default instead of throwing — many component tests render without the full app tree", () => {
    function Bare() {
      const { resolved } = useTheme();
      return <span data-testid="resolved">{resolved}</span>;
    }
    expect(() => render(<Bare />)).not.toThrow();
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("setChoice is a harmless no-op outside a provider", () => {
    function Bare() {
      const { setChoice } = useTheme();
      return <button onClick={() => setChoice("dark" as ThemeChoice)}>set</button>;
    }
    render(<Bare />);
    expect(() => screen.getByText("set").click()).not.toThrow();
  });
});
