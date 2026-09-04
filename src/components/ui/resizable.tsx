"use client";

import * as React from "react";
import { GripVertical } from "lucide-react";
import * as ResizablePrimitive from "react-resizable-panels";
import { cn } from "@/lib/design/cn";

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      className={cn("flex h-full w-full data-[panel-group-direction=vertical]:flex-col", className)}
      {...props}
    />
  );
}

// Enterprise Investigation UI Revamp — root cause of the reported
// "sometimes impossible to scroll to the final content" defect, found by
// walking the live DOM ancestor chain of the investigation workspace's
// scroll container: react-resizable-panels' own <Panel> renders a plain
// display:block div. Every consumer here (this file's own
// investigation-workspace.tsx content pane, ContextRail) sizes its
// content with flex-context classes — flex-1/min-h-0 — which are inert
// inside a block formatting context; the child instead grows to its full
// content height, and the *panel's own* `overflow: hidden` (set by the
// library itself, for resize clipping) then silently clips whatever
// doesn't fit, with no scrollbar and no way to reach it. `flex h-full
// min-h-0 flex-col` here establishes the flex column context every
// consumer already assumed existed, fixed once at the shared primitive
// rather than patched per page.
function ResizablePanel({ className, ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel className={cn("flex h-full min-h-0 flex-col", className)} {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-2 after:-translate-x-1/2 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-2 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-6 w-3 items-center justify-center rounded-sm border border-border bg-card">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      ) : null}
    </ResizablePrimitive.PanelResizeHandle>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
