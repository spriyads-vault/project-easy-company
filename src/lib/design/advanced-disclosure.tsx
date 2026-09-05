// ADVANCED DISCLOSURE (UX-04): the one place a manual/structured form gets
// tucked away once its agent-first equivalent exists — "this ticket FAILS
// if the old form journey remains the easiest/default journey." Built on
// native <details>/<summary> deliberately, not a JS-driven
// show/hide-with-state component: <details> is keyboard-operable and
// screen-reader-exposed (expanded/collapsed) with zero extra ARIA wiring,
// and — the property this component actually needs — the browser only
// ever toggles the CSS visibility of its content, never unmounts it, so
// whatever's inside (a form's typed-but-unsubmitted values) survives
// opening and closing without any of this component's own doing.
//
// `open` is passed once and never reassigned by this component after
// mount — an intentional "uncontrolled with an initial value" use of
// React's prop diffing (React only reapplies an HTML attribute when the
// PROP it was given changes between renders, not by introspecting the live
// DOM) so the browser's native user-driven toggle state survives a parent
// re-render for an unrelated reason.
interface AdvancedDisclosureProps {
  label?: string;
  /** Initial open/closed state — read once, not synced afterward (see
   * module comment). @default false */
  defaultOpen?: boolean;
  /** UX-07: optional trailing summary text shown next to the label while
   * closed (e.g. "4 checks · 33ms") — lets a reader see the real gist of
   * what's inside without opening it. Rendered muted, never a fabricated
   * value; omit when there's nothing real to summarize. Optional/undefined
   * keeps every pre-UX-07 call site (Advanced entry forms) unaffected. */
  meta?: React.ReactNode;
  children: React.ReactNode;
}

export function AdvancedDisclosure({
  label = "Advanced",
  defaultOpen = false,
  meta,
  children,
}: AdvancedDisclosureProps) {
  return (
    <details open={defaultOpen} className="group/advanced">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="inline-block transition-transform group-open/advanced:rotate-90">
          ▸
        </span>
        {label}
        {meta ? <span className="normal-case tracking-normal text-muted-foreground/80">· {meta}</span> : null}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}
