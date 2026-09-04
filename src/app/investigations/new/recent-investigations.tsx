"use client";

// UX-05 Workstream B: the New Investigation page's continuation layer —
// real recent investigations filling the lower working area instead of a
// large empty region below the composer. Fetches through a Server Action
// (loadRecentInvestigations) rather than being passed down from the page's
// own server render, specifically so a query failure here shows a local
// retry without the intake composer above it ever being affected — the
// composer is the primary task and must stay usable regardless.
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { loadRecentInvestigations } from "./actions";
import type { InvestigationSummary } from "@/lib/investigations/queries";
import { WORKFLOW_STATE_LABEL, WORKFLOW_STATE_TONE } from "@/lib/investigation/derive-workflow-state";
import { DeviceGlyph } from "@/lib/design/device-glyph";
import { surface, typography } from "@/lib/design/tokens";

const INITIAL_LIMIT = 6;

const TONE_CLASS: Record<string, string> = {
  waiting: "text-muted-foreground",
  idle: "text-muted-foreground",
  active: "text-primary",
  // Matches heroStatusStyle.complete (agent-status-pill.tsx) — "complete"
  // only reaches this tone via a truthful "resolved" case status, so it
  // gets the reserved success green, not the cobalt "active work" accent.
  complete: "text-success",
  failed: "text-destructive",
};

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function CardSkeleton() {
  return (
    <div className={`flex animate-pulse flex-col gap-3 p-4 ${surface.card}`}>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 shrink-0 rounded-lg bg-secondary" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="h-3.5 w-2/3 rounded bg-secondary" />
          <div className="h-3 w-1/2 rounded bg-secondary" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-secondary" />
      <div className="h-3 w-1/3 rounded bg-secondary" />
    </div>
  );
}

function RecentInvestigationCard({ investigation }: { investigation: InvestigationSummary }) {
  const tone = TONE_CLASS[WORKFLOW_STATE_TONE[investigation.workflowState]];
  return (
    <Link
      href={`/cases/${investigation.id}/investigation`}
      className={`flex flex-col gap-3 p-4 text-left transition-colors hover:bg-secondary/60 ${surface.card}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40">
          <DeviceGlyph className="h-7 w-7" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{investigation.productName}</span>
          <span className={typography.metadata}>{investigation.revisionLabel}</span>
        </div>
      </div>
      <p className="line-clamp-1 text-sm text-muted-foreground">{investigation.title}</p>
      <div className="mt-auto flex items-center justify-between gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-medium ${tone}`}>
          {WORKFLOW_STATE_LABEL[investigation.workflowState]}
        </span>
        <span className="shrink-0 text-muted-foreground">{formatRelativeTime(investigation.updatedAt)}</span>
      </div>
      <p className="border-t border-border pt-2 text-xs text-muted-foreground">{investigation.requiredNextAction}</p>
    </Link>
  );
}

export function RecentInvestigations() {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [investigations, setInvestigations] = useState<InvestigationSummary[]>([]);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      setState("loading");
      const result = await loadRecentInvestigations();
      if (result.error) {
        setState("error");
        return;
      }
      setInvestigations(result.investigations);
      setState("loaded");
    });
  }

  useEffect(() => {
    // The section fetches real recent work after mount, deliberately not
    // blocking the composer above it on the same round trip; see the
    // module comment.
    load();
  }, []);

  if (state === "loading") {
    return (
      <section className="flex flex-col gap-3">
        <h2 className={typography.sectionHeading}>Recent investigations</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <CardSkeleton key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className="flex flex-col gap-3">
        <h2 className={typography.sectionHeading}>Recent investigations</h2>
        <div className={`flex flex-col items-start gap-3 p-6 ${surface.card}`}>
          <p className="text-sm text-muted-foreground">Could not load recent investigations right now.</p>
          <button
            type="button"
            onClick={load}
            disabled={isPending}
            className="rounded-[10px] border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            {isPending ? "Retrying…" : "Retry"}
          </button>
        </div>
      </section>
    );
  }

  if (investigations.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className={typography.sectionHeading}>Recent investigations</h2>
        <div className={`p-6 ${surface.card}`}>
          <p className="text-sm text-muted-foreground">
            No investigations yet. Once you open one, it will show up here so you can pick up where you left off —
            try describing something like{" "}
            <span className="text-foreground">
              &ldquo;200 MHz peak measured at +7.4 dB above the limit during WiFi TX with the display active&rdquo;
            </span>{" "}
            above.
          </p>
        </div>
      </section>
    );
  }

  const visible = investigations.slice(0, INITIAL_LIMIT);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className={typography.sectionHeading}>Recent investigations</h2>
        {investigations.length > INITIAL_LIMIT ? (
          <Link href="/investigations" className="text-xs font-medium text-primary hover:underline">
            View all investigations
          </Link>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((investigation) => (
          <RecentInvestigationCard key={investigation.id} investigation={investigation} />
        ))}
      </div>
    </section>
  );
}
