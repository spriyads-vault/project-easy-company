import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShellChrome } from "./app-shell-chrome";
import * as workspaceActions from "@/app/workspace/actions";

// CommandPalette (rendered inside AppShellChrome) calls next/navigation's
// useRouter() to push a route on selection — outside a real Next App
// Router runtime that throws "invariant expected app router to be
// mounted", so every test in this file needs it mocked, same as any
// other component test that touches next/navigation would.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// UX-09: signOut is a real Server Action ("use server") — mocked the same
// way every other actions.ts import in this codebase's component tests
// is (see sign-in-form.test.tsx), so the "Sign out" menu item can be
// asserted to actually call it, not just render.
vi.mock("@/app/workspace/actions", () => ({
  signOut: vi.fn(),
}));
const mockedSignOut = vi.mocked(workspaceActions.signOut);

beforeEach(() => {
  window.localStorage.clear();
  mockedSignOut.mockClear();
});

function renderShell(active: "investigations" | "products" | "sources" | "benchmarks" = "investigations") {
  return render(
    <AppShellChrome
      active={active}
      workspaceName="Acme Hardware"
      userEmail="engineer@acme.test"
      investigationsBadgeCount={0}
    >
      <div>page content</div>
    </AppShellChrome>,
  );
}

describe("AppShellChrome (shadcn Sidebar)", () => {
  it("renders the real Crado mark and CRADO wordmark in the sidebar header", () => {
    const { container } = renderShell();
    // alt="" (decorative — the adjacent "CRADO" text already labels the
    // link) intentionally drops this out of the accessibility tree's "img"
    // role, so it's queried directly rather than via getByRole.
    const mark = container.querySelector("img");
    expect(mark).toHaveAttribute("src", expect.stringContaining("crado-mark-white"));
    expect(screen.getByText("CRADO")).toBeInTheDocument();
  });

  it("marks the current route active via data-active, and only that route", () => {
    renderShell("products");
    const productsLink = screen.getByRole("link", { name: /Products & revisions/ });
    const sourcesLink = screen.getByRole("link", { name: /Sources/ });
    expect(productsLink).toHaveAttribute("data-active", "true");
    expect(sourcesLink).toHaveAttribute("data-active", "false");
  });

  it("shows the New investigation primary action pointing at the real intake route", () => {
    renderShell();
    expect(screen.getByRole("link", { name: /New investigation/ })).toHaveAttribute("href", "/investigations/new");
  });

  it("renders a real-count badge only when the count is greater than zero", () => {
    const { rerender } = render(
      <AppShellChrome workspaceName="Acme" userEmail={null} investigationsBadgeCount={0}>
        <div />
      </AppShellChrome>,
    );
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();

    rerender(
      <AppShellChrome workspaceName="Acme" userEmail={null} investigationsBadgeCount={3}>
        <div />
      </AppShellChrome>,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("toggles between expanded and collapsed via the sidebar trigger", () => {
    renderShell();
    const sidebar = document.querySelector('[data-slot="sidebar"][data-state]') as HTMLElement;
    expect(sidebar).toHaveAttribute("data-state", "expanded");

    // Two "Toggle sidebar" triggers exist in the DOM at once (the desktop
    // header one and the mobile top-bar one, hidden from each other only
    // via a `sm:` CSS breakpoint jsdom doesn't evaluate) — both control the
    // same shared useSidebar() state, so exercising either proves the
    // toggle works.
    const [trigger] = screen.getAllByRole("button", { name: /toggle sidebar/i });
    fireEvent.click(trigger);
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    fireEvent.click(trigger);
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("toggles via the Cmd/Ctrl+B keyboard shortcut without needing the trigger button", () => {
    renderShell();
    const sidebar = document.querySelector('[data-slot="sidebar"][data-state]') as HTMLElement;
    expect(sidebar).toHaveAttribute("data-state", "expanded");

    fireEvent.keyDown(window, { key: "b", metaKey: true });
    expect(sidebar).toHaveAttribute("data-state", "collapsed");

    fireEvent.keyDown(window, { key: "b", ctrlKey: true });
    expect(sidebar).toHaveAttribute("data-state", "expanded");
  });

  it("persists the collapsed preference across remounts via localStorage", () => {
    const { unmount } = renderShell();
    const [trigger] = screen.getAllByRole("button", { name: /toggle sidebar/i });
    fireEvent.click(trigger);
    expect(window.localStorage.getItem("crado.sidebar.collapsed")).toBe("1");
    unmount();

    renderShell();
    const sidebar = document.querySelector('[data-slot="sidebar"][data-state]') as HTMLElement;
    expect(sidebar).toHaveAttribute("data-state", "collapsed");
  });

  it("opens the command palette dialog from the sidebar Search action", () => {
    renderShell();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("renders the account menu trigger with the real workspace name (not a placeholder)", () => {
    renderShell();
    expect(screen.getByRole("button", { name: /Acme Hardware/ })).toBeInTheDocument();
  });

  it("keeps every nav item's accessible name once collapsed, even though its visible label text is hidden", () => {
    renderShell("products");
    const [trigger] = screen.getAllByRole("button", { name: /toggle sidebar/i });
    fireEvent.click(trigger);

    expect(screen.getByRole("link", { name: "Investigations" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Products & revisions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sources" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New investigation" })).toBeInTheDocument();
  });

  it("renders a Recent region with real product names, truthful workflow-state labels, and working links", () => {
    render(
      <AppShellChrome
        workspaceName="Acme"
        userEmail={null}
        recentInvestigations={[
          {
            id: "case-1",
            title: "200 MHz radiated emissions",
            productName: "Gateway X",
            revisionLabel: "Rev17",
            workflowState: "ready_for_next_test",
          },
        ]}
      >
        <div />
      </AppShellChrome>,
    );
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("Ready for next test")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Gateway X/ });
    expect(link).toHaveAttribute("href", "/cases/case-1/investigation");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/investigations");
  });

  it("omits the Recent region entirely when there are no recent investigations", () => {
    render(
      <AppShellChrome workspaceName="Acme" userEmail={null} recentInvestigations={[]}>
        <div />
      </AppShellChrome>,
    );
    expect(screen.queryByText("Recent")).not.toBeInTheDocument();
  });

  // UX-09: this used to be a <form action={signOut}> wrapping a
  // DropdownMenuItem asChild button — Radix closes (and Portal-unmounts)
  // the menu synchronously on select, racing the native form submit the
  // browser would otherwise dispatch. This test fails against that old
  // markup: a synthetic click on the item never fires the form's submit
  // handler, so `mockedSignOut` is never called. It passes against the
  // current onSelect-calls-the-action-directly wiring because that call
  // doesn't depend on the button still being attached to the document.
  it("calls the real sign-out action when Sign out is selected from the account menu (UX-09)", async () => {
    renderShell();
    const trigger = screen.getByRole("button", { name: /Acme Hardware/ });
    // Radix's DropdownMenuTrigger opens on pointerdown, not a bare click —
    // a real mouse click emits both, but jsdom's fireEvent.click alone
    // doesn't, so the trigger needs the full sequence to actually open
    // the menu here (unrelated to the UX-09 fix itself).
    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1 });
    fireEvent.pointerUp(trigger, { button: 0, pointerId: 1 });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText("Sign out"));
    await waitFor(() => expect(mockedSignOut).toHaveBeenCalledTimes(1));
  });
});
