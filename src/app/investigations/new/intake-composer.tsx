"use client";

// AGENT-FIRST INTAKE (UX-04 Agent-Native): one composer, one confirmation
// surface, one <form> — never a multi-field form journey. Stage 1 is free
// text (+ optional attachment); "Continue" runs the deterministic
// extraction client-side (parseInvestigationIntake — never a model call,
// see docs/UX_AGENT_NATIVE.md §7) and reveals stage 2, an *editable*
// confirmation surface. Nothing is persisted until the engineer submits
// stage 2 — "do not persist inferred authoritative state silently."
//
// Deliberately ONE <form> spanning both stages (not two separate forms):
// the file input lives inside it from the start, so switching stages
// never unmounts/remounts that input and loses the browser's selected
// file — React only ever hides/shows sibling blocks inside it.
import { useActionState, useRef, useState } from "react";
import { Paperclip, Sparkles } from "lucide-react";
import { createInvestigationIntake, type IntakeFormState } from "./actions";
import { parseInvestigationIntake, type ProductCandidate } from "@/lib/investigations/parse-investigation-intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { surface, text, typography } from "@/lib/design/tokens";

const initialState: IntakeFormState = {};

interface IntakeComposerProps {
  products: ProductCandidate[];
}

export function IntakeComposer({ products }: IntakeComposerProps) {
  const [state, formAction, pending] = useActionState(createInvestigationIntake, initialState);
  const [stage, setStage] = useState<"compose" | "confirm">("compose");
  const [draft, setDraft] = useState("");
  const [attachmentName, setAttachmentName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productMode, setProductMode] = useState<"existing" | "new">("existing");
  const [productId, setProductId] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [frequencyMhz, setFrequencyMhz] = useState("");
  const [marginDb, setMarginDb] = useState("");
  const [operatingMode, setOperatingMode] = useState("");

  function handleContinue() {
    if (!draft.trim()) return;
    const result = parseInvestigationIntake(draft, products);
    if (result.productMatch) {
      setProductMode("existing");
      setProductId(result.productMatch.id);
    } else {
      setProductMode("new");
      setNewProductName(result.productNameGuess ?? "");
    }
    setRevisionLabel(result.revisionLabel ?? "");
    setFrequencyMhz(result.frequencyMhz !== null ? String(result.frequencyMhz) : "");
    setMarginDb(result.marginDb !== null ? String(result.marginDb) : "");
    setOperatingMode(result.operatingMode ?? "");
    setStage("confirm");
  }

  return (
    <form action={formAction} className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <input
        ref={fileInputRef}
        type="file"
        name="attachment"
        accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
        className="sr-only"
        onChange={(event) => setAttachmentName(event.target.files?.[0]?.name ?? null)}
      />

      {stage === "compose" ? (
        <>
          <div className="flex flex-col gap-1 text-center">
            <span className={text.kicker}>Crado</span>
            <h1 className={`${typography.pageTitle} text-2xl sm:text-3xl`}>What happened?</h1>
          </div>

          <div className={`flex flex-col gap-3 p-4 ${surface.floating}`}>
            <Textarea
              autoFocus
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Describe the failure, paste the measurement, or attach the test report…"
              className="resize-none border-none bg-transparent p-1 text-[15px] shadow-none focus-visible:ring-0"
            />
            <div className="flex items-center justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="h-3.5 w-3.5" />
                {attachmentName ?? "Attach"}
              </Button>
              <Button type="button" onClick={handleContinue} disabled={!draft.trim()}>
                <Sparkles className="h-4 w-4" />
                Continue
              </Button>
            </div>
          </div>

          {products.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <span className={typography.metadata}>Recently used product</span>
              <div className="flex flex-wrap justify-center gap-2">
                {products.slice(0, 4).map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setDraft((prev) => (prev ? `${prev} ${product.name}` : `${product.name} `))}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {product.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className={`${text.kicker} text-primary`}>Crado understood</span>
            <p className={typography.body}>Review and correct anything before Crado starts investigating.</p>
          </div>

          <div className={`flex flex-col gap-4 p-5 ${surface.card}`}>
            <div className="flex flex-col gap-1.5">
              <label className={typography.metadata}>Product</label>
              {productMode === "existing" && products.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <select
                    name="productId"
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    required
                    className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-primary/60"
                  >
                    <option value="">Choose a product…</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setProductMode("new")}
                    className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    This is a new product
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Input
                    name="newProductName"
                    required
                    value={newProductName}
                    onChange={(event) => setNewProductName(event.target.value)}
                    placeholder="e.g. Gateway X"
                  />
                  {products.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setProductMode("existing")}
                      className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    >
                      Use an existing product instead
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={typography.metadata}>Revision</label>
              <Input
                name="revisionLabel"
                required
                value={revisionLabel}
                onChange={(event) => setRevisionLabel(event.target.value)}
                placeholder="e.g. Rev17"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={typography.metadata}>Observed peak (MHz)</label>
                <Input
                  name="frequencyMhz"
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={frequencyMhz}
                  onChange={(event) => setFrequencyMhz(event.target.value)}
                  className={text.mono}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={typography.metadata}>Margin (dB vs. limit)</label>
                <Input
                  name="marginDb"
                  type="number"
                  step="any"
                  required
                  value={marginDb}
                  onChange={(event) => setMarginDb(event.target.value)}
                  placeholder="e.g. 7.4 or -3.6"
                  className={text.mono}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={typography.metadata}>Operating mode</label>
              <Input
                name="operatingMode"
                required
                value={operatingMode}
                onChange={(event) => setOperatingMode(event.target.value)}
                placeholder="e.g. WiFi TX + display active"
              />
            </div>

            {attachmentName ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {attachmentName} will be attached as a source.
              </div>
            ) : null}

            <p className={typography.metadata}>
              Missing: product architecture and engineering sources — attach schematics, datasheets, or notes
              anytime from the investigation workspace.
            </p>
          </div>

          {state.error ? (
            <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending} size="lg">
              {pending ? "Starting…" : "Start investigation"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStage("compose")} disabled={pending}>
              Edit
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
