// APPLICATION SHELL (UX-03): a very compact left rail replacing the old
// plain-text-only header — real destinations only. There is no dedicated
// "Cases" or "Products" index route in this app (both live under
// /workspace's product list), so the rail doesn't invent a fake split
// between them: the mark and the one "Workspace" item both go to
// /workspace, Sources goes to /documents, Benchmarks to /benchmarks, and
// Sign out reuses the exact server action the workspace page's own
// sign-out button already calls — no new auth/session logic.
//
// Deliberately a server component: every item is a plain Link or a form
// action, so nothing here needs client-side state. Tooltips are native
// `title` attributes (no JS, no new dependency) plus an `aria-label` for
// screen readers, per the ticket's "icons + tooltips" with no traditional
// SaaS sidebar.
import Link from "next/link";
import { signOut } from "@/app/workspace/actions";
import { rail } from "./theme";

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
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} title={label} aria-label={label} className={rail.item}>
      {children}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  // h-dvh (not flex-1 alone): the root layout's <body> only sets
  // min-h-full, so with tall canvas content it would otherwise grow past
  // the viewport and the *page* would scroll — leaving the floating
  // composer's `sticky bottom-0` pinned over content that hasn't
  // scrolled into view yet (nothing above it bounds its height). Forcing
  // this shell to exactly one viewport tall makes the canvas's own
  // `overflow-y-auto` the only thing that scrolls, so the top bar and
  // composer stay put and content never renders behind them.
  return (
    <div className="flex h-dvh min-h-0">
      {/* RESPONSIVE (UX-03): "no permanent huge sidebar if unnecessary" —
          the ticket's own mobile priority list (agent status, failure,
          investigation, next action, evidence, input) doesn't include app
          navigation, so the rail hides below `sm` rather than eating ~15%
          of a phone's width; the top bar's "← back" link still gets the
          engineer out of the case on a small screen. */}
      <nav aria-label="Crado" className={`hidden sm:flex ${rail.container}`}>
        <Link href="/workspace" title="Workspace" aria-label="Crado — workspace" className={rail.mark}>
          C
        </Link>
        <span aria-hidden="true" className={rail.separator} />
        <RailLink href="/workspace" label="Workspace">
          <HomeIcon />
        </RailLink>
        <RailLink href="/documents" label="Sources">
          <SourcesIcon />
        </RailLink>
        <RailLink href="/benchmarks" label="Benchmarks">
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
