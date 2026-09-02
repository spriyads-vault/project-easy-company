"use client";

// APPLICATION SHELL CHROME (UX-04 Agent-Native): the real collapsible
// sidebar — ~224px expanded (labels visible), collapses to ~56px
// (icon-only, tooltips) — plus the Cmd/Ctrl+K command palette and the
// account menu. Collapse state is a per-viewer convenience
// (localStorage), never anything the server needs to know about.
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  FolderOpen,
  LayoutList,
  LogOut,
  Package,
  PlusCircle,
  Search as SearchIcon,
} from "lucide-react";
import { signOut } from "@/app/workspace/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CommandPalette, useCommandPaletteShortcut, type PaletteInvestigation, type PaletteProduct } from "./command-palette";
import { rail } from "./tokens";

export type RailSection = "investigations" | "products" | "sources" | "benchmarks";

const NAV_ITEMS: { section: RailSection; href: string; label: string; icon: typeof LayoutList }[] = [
  { section: "investigations", href: "/investigations", label: "Investigations", icon: LayoutList },
  { section: "products", href: "/products", label: "Products", icon: Package },
  { section: "sources", href: "/documents", label: "Sources", icon: FolderOpen },
  { section: "benchmarks", href: "/benchmarks", label: "Benchmarks", icon: LayoutList },
];

const COLLAPSE_STORAGE_KEY = "crado.sidebar.collapsed";

interface AppShellChromeProps {
  children: React.ReactNode;
  active?: RailSection;
  workspaceName: string;
  userEmail: string | null;
  recentInvestigations?: PaletteInvestigation[];
  products?: PaletteProduct[];
}

export function AppShellChrome({
  children,
  active,
  workspaceName,
  userEmail,
  recentInvestigations = [],
  products = [],
}: AppShellChromeProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPaletteShortcut();

  useEffect(() => {
    // Reads a per-viewer preference after mount, deliberately not via a
    // lazy useState initializer: this component is server-rendered first
    // (where `window` doesn't exist), so evaluating localStorage during
    // the initial render would make the client's first render disagree
    // with the server's HTML and trigger a hydration mismatch. Syncing
    // after mount instead means collapsed-by-preference users see one
    // brief expanded-then-collapsed flash rather than a hydration error.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // Private browsing / storage blocked — default to expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Nothing to persist to — the toggle still works for this session.
      }
      return next;
    });
  }

  const initial = workspaceName.trim().charAt(0).toUpperCase() || "C";

  return (
    <TooltipProvider delayDuration={200}>
      {/* h-dvh (not flex-1 alone): see app-shell.tsx history — forces one
          viewport-tall shell so a page's own scroll region is the only
          thing that scrolls, never the whole document. */}
      <div className="flex h-dvh min-h-0">
        <nav
          aria-label="Crado"
          className={`hidden shrink-0 sm:flex ${rail.container} ${collapsed ? "w-14 items-center px-2" : "w-[224px] px-3"}`}
        >
          <div className={`flex items-center gap-2 px-1 pb-3 ${collapsed ? "justify-center" : ""}`}>
            <Link href="/investigations" title="Crado" aria-label="Crado — investigations" className={rail.mark}>
              C
            </Link>
            {!collapsed ? <span className="text-sm font-semibold tracking-tight text-foreground">Crado</span> : null}
          </div>

          <div className={`flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
            <RailAction
              href="/investigations/new"
              label="New investigation"
              icon={PlusCircle}
              collapsed={collapsed}
              primary
            />
            <RailAction
              label="Search"
              icon={SearchIcon}
              collapsed={collapsed}
              onClick={() => setPaletteOpen(true)}
              shortcut="⌘K"
            />
          </div>

          <span aria-hidden="true" className={rail.separator} />

          <div className={`flex flex-1 flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
            {NAV_ITEMS.map((item) => (
              <RailAction
                key={item.section}
                href={item.href}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
                active={active === item.section}
              />
            ))}
          </div>

          <div className={`flex flex-col gap-1 ${collapsed ? "items-center" : ""}`}>
            <RailAction
              label={collapsed ? "Expand" : "Collapse"}
              icon={collapsed ? ChevronsRight : ChevronsLeft}
              collapsed={collapsed}
              onClick={toggleCollapsed}
            />
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className={`flex h-9 items-center gap-2.5 rounded-lg px-1.5 text-left transition-colors hover:bg-secondary ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
                      </Avatar>
                      {!collapsed ? (
                        <span className="truncate text-sm text-foreground">{workspaceName}</span>
                      ) : null}
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                {collapsed ? <TooltipContent side="right">{workspaceName}</TooltipContent> : null}
              </Tooltip>
              <DropdownMenuContent align="end" side="right" sideOffset={12}>
                <DropdownMenuLabel>{workspaceName}</DropdownMenuLabel>
                {userEmail ? (
                  <div className="truncate px-2 pb-1.5 text-xs text-muted-foreground">{userEmail}</div>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/workspace">Workspace</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={signOut}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        recentInvestigations={recentInvestigations}
        products={products}
      />
    </TooltipProvider>
  );
}

function RailAction({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
  primary,
  onClick,
  shortcut,
}: {
  href?: string;
  label: string;
  icon: typeof LayoutList;
  collapsed: boolean;
  active?: boolean;
  primary?: boolean;
  onClick?: () => void;
  shortcut?: string;
}) {
  const baseClass = active ? rail.itemActive : rail.item;
  const content = collapsed ? (
    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${primary ? "text-primary" : ""}`}>
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
    </span>
  ) : (
    <span className={`flex w-full items-center gap-2.5 ${primary ? "text-primary" : ""}`}>
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {shortcut ? <span className="ml-auto text-[11px] text-muted-foreground">{shortcut}</span> : null}
    </span>
  );

  const trigger = href ? (
    <Link href={href} title={collapsed ? label : undefined} aria-label={label} aria-current={active ? "page" : undefined} className={baseClass}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} title={collapsed ? label : undefined} aria-label={label} className={baseClass}>
      {content}
    </button>
  );

  if (!collapsed) return trigger;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
