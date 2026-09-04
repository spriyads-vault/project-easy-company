// Auth enterprise redesign: the shared two-region shell for /login and
// /signup — a restrained Crado context pane plus a focused authentication
// pane, replacing the old single floating card centered on a dot-grid
// canvas. A Server Component (no hooks needed at this level); the two
// small pieces that do need the client — the theme control and the
// theme-aware logo — are their own tiny client components.
//
// No Privacy Policy / Terms of Service links: neither route exists in
// this repository (confirmed via search before writing this file), and
// the ticket that asked for this shell is explicit — "Only include
// links backed by real routes." The copyright line still renders as
// plain text; only the two legal links are omitted, and that omission
// is recorded in docs/PROGRESS.md, not silently absorbed.
import Link from "next/link";
import { ThemedMark } from "./themed-mark";
import { ThemeToggleCompact } from "./theme-toggle-compact";

const PRINCIPLES = [
  "Measurements remain the source of truth",
  "Deterministic checks stay distinguishable from inference",
  "Every decision remains tied to evidence and revision",
];

interface AuthShellProps {
  mode: "sign-in" | "sign-up";
  /** Sanitized post-auth destination, preserved across the Sign in <->
   * Sign up switch links so a deep link a visitor followed while signed
   * out ("/login?next=/cases/abc") survives choosing the wrong form
   * first. Always a same-origin path — see sanitizeRedirectTarget. */
  next: string;
  children: React.ReactNode;
}

// Exported so SignInForm/SignUpForm can render the same "below the
// form" switch link the ticket separately requires, without a second
// definition of the next-preservation rule.
export function switchHref(target: "/login" | "/signup", next: string): string {
  return next === "/investigations" ? target : `${target}?next=${encodeURIComponent(next)}`;
}

export function AuthShell({ mode, next, children }: AuthShellProps) {
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:flex-row">
      {/* Context pane — desktop/tablet only; the mobile tier keeps just
          the compact top bar and one context sentence below. */}
      <div className="hidden shrink-0 flex-col justify-between border-border bg-card px-10 py-10 lg:flex lg:w-[44%] lg:border-r xl:w-[42%] xl:px-14">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <ThemedMark width={20} height={23} className="shrink-0" />
          <span className="text-sm font-semibold tracking-tight">CRADO</span>
        </Link>

        <div className="flex max-w-md flex-col gap-6">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Regulation, inside the engineering loop.
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect product revisions, measurements, evidence and engineering decisions in one
            traceable investigation record.
          </p>
          <ul className="flex flex-col gap-3">
            {PRINCIPLES.map((principle) => (
              <li key={principle} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {principle}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">© {year} Crado</p>
      </div>

      <div className="flex flex-1 flex-col">
        {/* Mobile compact top bar */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <ThemedMark width={18} height={21} className="shrink-0" />
            <span className="text-sm font-semibold tracking-tight">CRADO</span>
          </Link>
          <ThemeToggleCompact />
        </div>

        {/* Desktop top-right utility area */}
        <div className="hidden items-center justify-end gap-4 px-8 py-5 lg:flex xl:px-12">
          <ThemeToggleCompact />
          {mode === "sign-in" ? (
            <span className="text-sm text-muted-foreground">
              New to Crado?{" "}
              <Link href={switchHref("/signup", next)} className="font-medium text-primary hover:underline">
                Create account
              </Link>
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={switchHref("/login", next)} className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </span>
          )}
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-8 sm:px-8">
          <div className="flex w-full max-w-[420px] flex-col gap-6">
            {/* Mobile-only short context sentence — the full principle
                list and product statement are non-essential visual
                motif on this tier, per the responsive spec. */}
            <p className="text-sm text-muted-foreground lg:hidden">
              Regulation, inside the engineering loop.
            </p>

            {children}
          </div>
        </div>

        <div className="border-t border-border px-6 py-4 text-center text-xs text-muted-foreground lg:hidden">
          © {year} Crado
        </div>
      </div>
    </div>
  );
}
