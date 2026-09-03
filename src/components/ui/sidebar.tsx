"use client";

// shadcn/ui Sidebar — ported from the canonical composition
// (SidebarProvider/Sidebar/SidebarHeader/SidebarContent/SidebarGroup/
// SidebarGroupLabel/SidebarMenu/SidebarMenuItem/SidebarMenuButton/
// SidebarMenuBadge/SidebarFooter/SidebarRail/SidebarInset/SidebarTrigger)
// onto this repo's existing Radix + cva + shadcn-token stack, per UX-05
// Workstream A: "port... in the way compatible with the existing stack",
// not a fresh CLI scaffold that would overwrite the hand-tuned
// tooltip/sheet/skeleton/separator primitives already in this directory.
//
// Deviations from the stock component, both deliberate:
//   - Collapsed-state persistence uses this repo's existing localStorage
//     key/convention (crado.sidebar.collapsed, previously owned by
//     app-shell-chrome.tsx) instead of the stock component's cookie —
//     "persist... only through an existing approved preference/cookie
//     mechanism" and localStorage was already the approved one here.
//   - useIsMobile is the shared useSyncExternalStore matchMedia hook
//     already established by investigation-workspace.tsx
//     (use-media-query.ts), not a fresh isMobile implementation — one
//     hydration-safe breakpoint pattern for the whole app.
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import { cn } from "@/lib/design/cn";
import { useMediaQuery } from "@/lib/design/use-media-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "crado.sidebar.collapsed";
const SIDEBAR_WIDTH = "14rem"; // 224px — matches the previous rail's expanded width
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3.5rem"; // 56px — matches the previous rail's collapsed width
const SIDEBAR_KEYBOARD_SHORTCUT = "b";
const SIDEBAR_MOBILE_QUERY = "(max-width: 767px)";

type SidebarState = "expanded" | "collapsed";

interface SidebarContextValue {
  state: SidebarState;
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

export function useSidebar(): SidebarContextValue {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used within a SidebarProvider.");
  return context;
}

interface SidebarProviderProps extends React.ComponentProps<"div"> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const isMobile = useMediaQuery(SIDEBAR_MOBILE_QUERY);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = openProp ?? internalOpen;

  const setOpen = React.useCallback(
    (value: boolean) => {
      if (setOpenProp) {
        setOpenProp(value);
      } else {
        setInternalOpen(value);
      }
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, value ? "0" : "1");
      } catch {
        // Private browsing / storage blocked — the toggle still works for
        // this session, it just won't be remembered on the next visit.
      }
    },
    [setOpenProp],
  );

  React.useEffect(() => {
    // Same hydration-safe read-after-mount pattern the previous rail used:
    // the server always renders "expanded" (nothing to disagree with), and
    // a collapsed-by-preference viewer sees one brief expanded-then-
    // collapsed flash instead of a hydration mismatch.
    if (openProp !== undefined) return;
    try {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      if (stored === "1") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInternalOpen(false);
      }
    } catch {
      // Default (expanded) stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((value) => !value) : setOpen(!open);
  }, [isMobile, open, setOpen]);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  const state: SidebarState = open ? "expanded" : "collapsed";

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({ state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={200}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn("flex h-dvh min-h-0 w-full", className)}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
}

interface SidebarProps extends React.ComponentProps<"div"> {
  side?: "left" | "right";
  collapsible?: "offcanvas" | "icon" | "none";
}

export function Sidebar({
  side = "left",
  collapsible = "icon",
  className,
  children,
  ...props
}: SidebarProps) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn("flex h-full w-(--sidebar-width) flex-col bg-sidebar text-sidebar-foreground", className)}
        {...props}
      >
        {children}
      </div>
    );
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-slot="sidebar"
          data-mobile="true"
          side={side}
          showClose={false}
          className="w-(--sidebar-width-mobile) border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
          style={{ "--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE } as React.CSSProperties}
        >
          <div className="sr-only">
            <h2>Crado navigation</h2>
            <p>The primary application sidebar.</p>
          </div>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <div
      data-slot="sidebar"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-side={side}
      className="group peer hidden shrink-0 text-sidebar-foreground sm:block"
    >
      {/* Spacer that reserves layout width and animates it — the real
          fixed panel below is visually stacked on top. */}
      <div
        className={cn(
          "relative h-dvh w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          "group-data-[collapsible=offcanvas]:w-0",
        )}
      />
      <div
        className={cn(
          "fixed inset-y-0 z-10 hidden h-dvh w-(--sidebar-width) transition-[left,right,width] duration-200 ease-linear sm:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
          side === "left" ? "border-r border-sidebar-border" : "border-l border-sidebar-border",
          className,
        )}
        {...props}
      >
        <div
          data-slot="sidebar-inner"
          className="flex h-full w-full flex-col bg-sidebar"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, state } = useSidebar();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          data-slot="sidebar-trigger"
          variant="ghost"
          size="icon"
          className={cn("h-7 w-7", className)}
          onClick={(event) => {
            onClick?.(event);
            toggleSidebar();
          }}
          {...props}
        >
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"} (⌘B)</TooltipContent>
    </Tooltip>
  );
}

// A thin edge rail that toggles the sidebar on click and shows a resize
// cursor — the stock shadcn affordance for "grab the seam" without
// actually implementing drag-resize (this sidebar's width is fixed, only
// its collapsed/expanded state varies).
export function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      data-slot="sidebar-rail"
      aria-label="Toggle sidebar"
      title="Toggle sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      className={cn(
        "absolute inset-y-0 right-0 hidden w-4 -translate-x-1/2 cursor-w-resize items-center justify-center sm:flex",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-transparent hover:after:bg-sidebar-border",
        "group-data-[side=left]:cursor-w-resize group-data-[side=right]:cursor-e-resize",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col bg-background", className)}
      {...props}
    />
  );
}

export function SidebarInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input data-slot="sidebar-input" className={cn("h-8 bg-background/60 shadow-none", className)} {...props} />;
}

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("flex flex-col gap-2 p-2.5", className)} {...props} />;
}

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("flex flex-col gap-2 p-2.5", className)} {...props} />;
}

export function SidebarSeparator({ className, ...props }: React.ComponentProps<typeof Separator>) {
  return <Separator data-slot="sidebar-separator" className={cn("mx-2.5 w-auto bg-sidebar-border", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto",
        "group-data-[collapsible=icon]:overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group" className={cn("relative flex w-full min-w-0 flex-col p-2.5", className)} {...props} />;
}

export function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      data-slot="sidebar-group-label"
      className={cn(
        "flex h-7 shrink-0 items-center px-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/50",
        "transition-[margin,opacity] duration-200 ease-linear",
        "group-data-[collapsible=icon]:-mt-7 group-data-[collapsible=icon]:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-content" className={cn("w-full text-sm", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex w-full min-w-0 flex-col gap-0.5", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("group/menu-item relative", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  // Collapsed-to-icon mode hides every non-icon child outright
  // (group-data-[collapsible=icon]:[&>span]:hidden, ditto :[&>kbd]) rather
  // than relying on overflow-hidden + a fixed size-9 box to visually clip
  // them — clipping alone left a stray centered sliver of text/icon
  // visible (justify-center centers the *whole* icon+label row, then
  // clips both edges evenly, so a fragment of the label survives in the
  // middle). Hiding the label node also removes it from the accessible
  // name computation, though — SidebarMenuButton below compensates by
  // promoting its `tooltip` prop to a real aria-label whenever the caller
  // hasn't already supplied one, so collapsed mode never ships an
  // unlabeled control.
  "peer/menu-button flex w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-[18px] [&>svg]:shrink-0 group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:[&>span]:hidden group-data-[collapsible=icon]:[&>kbd]:hidden",
  {
    variants: {
      variant: {
        default: "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground",
        active: "bg-sidebar-accent font-medium text-sidebar-foreground shadow-[inset_2px_0_0_var(--color-primary)]",
        primary: "text-primary hover:bg-sidebar-accent",
      },
      size: {
        default: "h-9",
        sm: "h-8 text-xs",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

interface SidebarMenuButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof sidebarMenuButtonVariants> {
  asChild?: boolean;
  isActive?: boolean;
  tooltip?: string;
}

export function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant,
  size,
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const { state, isMobile } = useSidebar();
  const Comp = asChild ? Slot : "button";

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      // Collapsed-to-icon mode hides the visible label text entirely (see
      // the variants' [&>span]:hidden above), which would otherwise strip
      // the accessible name along with it — real screen readers, not just
      // the visual tooltip, need a name here. tooltip doubles as that
      // aria-label whenever the caller hasn't already supplied one.
      aria-label={tooltip && !("aria-label" in props) ? tooltip : props["aria-label"]}
      className={cn(sidebarMenuButtonVariants({ variant: isActive ? "active" : variant, size, className }))}
      {...props}
    />
  );

  if (!tooltip || state !== "collapsed" || isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        // Absolutely positioned against SidebarMenuItem's `relative` — the
        // button it sits beside is a full-width flex row on its own, so a
        // normal-flow sibling (ml-auto included) would wrap onto its own
        // line instead of sitting inline at the row's right edge.
        "pointer-events-none absolute right-1.5 top-1/2 flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full bg-sidebar-accent px-1.5 text-[11px] font-medium tabular-nums text-sidebar-foreground/80",
        "group-data-[collapsible=icon]:hidden",
        className,
      )}
      {...props}
    />
  );
}

export function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & { showIcon?: boolean }) {
  // A fixed label width, not a randomized one (this repo's lint rules
  // reject calling an impure function like Math.random during render) —
  // a real loading skeleton doesn't need per-row variance to read as one.
  return (
    <div data-slot="sidebar-menu-skeleton" className={cn("flex h-9 items-center gap-2.5 rounded-lg px-2.5", className)} {...props}>
      {showIcon ? <Skeleton className="size-4 rounded-md" /> : null}
      <Skeleton className="h-3.5 flex-1 max-w-[70%]" />
    </div>
  );
}
