// APPLICATION SHELL (UX-04): the one compact left rail shared by every
// authenticated route — promoted from UX-03's cases-only
// src/app/cases/[caseId]/investigation/app-shell.tsx so "do not leave
// some routes using the old visual system" actually holds. Real
// destinations only: there's no dedicated "Cases" or "Products" index
// route in this app (both live under /workspace's product list), so the
// rail doesn't invent a split it doesn't have. `active` lets each
// route's own layout mark its own rail item current — a server-only
// prop (no client JS needed for this, since each layout already knows
// which page it is).
import Link from "next/link";
import { signOut } from "@/app/workspace/actions";
import { rail } from "./tokens";

export type RailSection = "workspace" | "sources" | "benchmarks";

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SourcesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M5.5 2.5h6.086a1 1 0 0 1 .707.293l2.414 2.414a1 1 0 0 1 .293.707V17a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.25 9.5h5.5M7.25 12.5h5.5M7.25 6.5h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function BenchmarksIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path d="M4 16.5V11m4.5 5.5V6.5M13 16.5V9m4.5 7.5v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M3 16.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-[18px] w-[18px]" aria-hidden="true">
      <path
        d="M8 17H4.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1H8M13 13.5 17 10l-4-3.5M17 10H7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={active ? rail.itemActive : rail.item}
    >
      {children}
    </Link>
  );
}

interface AppShellProps {
  children: React.ReactNode;
  /** Which rail item is "current" for this route — omit on a route the
   * rail doesn't represent (e.g. a case/investigation page, which is
   * reached *from* Workspace but isn't Workspace itself). */
  active?: RailSection;
}

export function AppShell({ children, active }: AppShellProps) {
  // h-dvh (not flex-1 alone): the root layout's <body> only sets
  // min-h-full, so tall page content would otherwise grow past the
  // viewport and the *page* would scroll instead of this shell's own
  // content region — see the UX-03 PROGRESS.md entry for the floating-
  // composer bug this caused there. Forcing one viewport-tall shell here
  // makes each page's own scroll container (if any) the only thing that
  // scrolls.
  return (
    <div className="flex h-dvh min-h-0">
      {/* RESPONSIVE: no permanent huge sidebar on a phone — hides below
          `sm` rather than eating width a small screen doesn't have to
          spare. */}
      <nav aria-label="Crado" className={`hidden sm:flex ${rail.container}`}>
        <Link href="/workspace" title="Workspace" aria-label="Crado — workspace" className={rail.mark}>
          C
        </Link>
        <span aria-hidden="true" className={rail.separator} />
        <RailLink href="/workspace" label="Workspace" active={active === "workspace"}>
          <HomeIcon />
        </RailLink>
        <RailLink href="/documents" label="Sources" active={active === "sources"}>
          <SourcesIcon />
        </RailLink>
        <RailLink href="/benchmarks" label="Benchmarks" active={active === "benchmarks"}>
          <BenchmarksIcon />
        </RailLink>
        <form action={signOut} className="mt-auto">
          <button type="submit" title="Sign out" aria-label="Sign out" className={rail.item}>
            <SignOutIcon />
          </button>
        </form>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
