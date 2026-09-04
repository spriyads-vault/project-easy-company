"use client";

// APPLICATION SHELL CHROME (UX-05 Workstream A): the real shadcn Sidebar
// composition — SidebarProvider/Sidebar/SidebarHeader/SidebarContent/
// SidebarGroup/SidebarGroupLabel/SidebarMenu/SidebarMenuItem/
// SidebarMenuButton/SidebarMenuBadge/SidebarFooter/SidebarRail/
// SidebarInset/SidebarTrigger — plus the Cmd/Ctrl+K command palette and
// the account menu. Collapsed-state persistence is owned by
// SidebarProvider itself (src/components/ui/sidebar.tsx), reusing this
// app's existing localStorage key rather than inventing a new mechanism.
import Image from "next/image";
import Link from "next/link";
import {
  Beaker,
  CheckCircle2,
  FolderOpen,
  LayoutList,
  LogOut,
  Monitor,
  Moon,
  Package,
  PlusCircle,
  Search as SearchIcon,
  Sun,
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
import { useTheme, type ThemeChoice } from "./theme-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { CommandPalette, useCommandPaletteShortcut, type PaletteInvestigation, type PaletteProduct } from "./command-palette";

export type RailSection = "investigations" | "products" | "sources" | "benchmarks";

const THEME_OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

// A compact three-way segmented control, not a submenu — switching
// themes is a single click and the menu deliberately stays open so the
// choice can be compared without reopening it. Plain buttons (not
// DropdownMenuItem) so Radix's select-to-close behavior doesn't fire.
function ThemeMenuControl() {
  const { choice, setChoice } = useTheme();
  return (
    <div className="px-2 py-1.5">
      <div className="mb-1.5 text-xs text-muted-foreground">Theme</div>
      <div role="radiogroup" aria-label="Theme" className="inline-flex w-full rounded-[8px] border border-border bg-secondary p-0.5">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = choice === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              title={label}
              onClick={() => setChoice(value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface AppShellChromeProps {
  children: React.ReactNode;
  active?: RailSection;
  workspaceName: string;
  userEmail: string | null;
  /** Investigations genuinely waiting on the engineer (needs_evidence or
   * ready_for_review) — 0 renders no badge at all, never a fabricated
   * number. */
  investigationsBadgeCount?: number;
  recentInvestigations?: PaletteInvestigation[];
  products?: PaletteProduct[];
}

export function AppShellChrome({
  children,
  active,
  workspaceName,
  userEmail,
  investigationsBadgeCount = 0,
  recentInvestigations = [],
  products = [],
}: AppShellChromeProps) {
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPaletteShortcut();
  const initial = workspaceName.trim().charAt(0).toUpperCase() || "C";

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center justify-between gap-2 px-1 pt-0.5 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-2">
            <Link
              href="/investigations"
              aria-label="Crado — investigations"
              className="flex min-w-0 items-center gap-2"
            >
              <Image
                src="/brand/crado-mark-white.png"
                alt=""
                aria-hidden="true"
                width={20}
                height={23}
                priority
                className="shrink-0"
              />
              <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                CRADO
              </span>
            </Link>
            {/* Stays visible (stacked below the mark) even collapsed —
                the trigger must never rely solely on the invisible
                hover-to-toggle SidebarRail for discoverability. */}
            <SidebarTrigger />
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild variant="primary" tooltip="New investigation">
                  <Link href="/investigations/new">
                    <PlusCircle aria-hidden="true" />
                    <span>New investigation</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setPaletteOpen(true)} tooltip="Search (⌘K)">
                  <SearchIcon aria-hidden="true" />
                  <span>Search</span>
                  <kbd className="ml-auto text-[11px] text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">⌘K</kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Work</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={active === "investigations"} tooltip="Investigations">
                    <Link href="/investigations">
                      <LayoutList aria-hidden="true" />
                      <span>Investigations</span>
                    </Link>
                  </SidebarMenuButton>
                  {investigationsBadgeCount > 0 ? (
                    <SidebarMenuBadge>{investigationsBadgeCount}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Resolved cases">
                    <Link href="/investigations?filter=resolved">
                      <CheckCircle2 aria-hidden="true" />
                      <span>Resolved cases</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Engineering context</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={active === "products"} tooltip="Products & revisions">
                    <Link href="/products">
                      <Package aria-hidden="true" />
                      <span>Products & revisions</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={active === "sources"} tooltip="Sources">
                    <Link href="/documents">
                      <FolderOpen aria-hidden="true" />
                      <span>Sources</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={active === "benchmarks"} tooltip="Benchmarks">
                    <Link href="/benchmarks">
                      <Beaker aria-hidden="true" />
                      <span>Benchmarks</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton tooltip={workspaceName} className="h-10">
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="text-[10px]">{initial}</AvatarFallback>
                    </Avatar>
                    <span className="truncate">{workspaceName}</span>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="right" sideOffset={12} className="min-w-56">
                  <DropdownMenuLabel>{workspaceName}</DropdownMenuLabel>
                  {userEmail ? (
                    <div className="truncate px-2 pb-1.5 text-xs text-muted-foreground">{userEmail}</div>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/workspace">Workspace</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <ThemeMenuControl />
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
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 sm:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold text-foreground">Crado</span>
        </div>
        {children}
      </SidebarInset>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        recentInvestigations={recentInvestigations}
        products={products}
      />
    </SidebarProvider>
  );
}
