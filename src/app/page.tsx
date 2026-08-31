export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-24 text-foreground">
      <div className="flex max-w-lg flex-col gap-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-foreground/50">
          Crado
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Regulation, inside the engineering loop.
        </h1>
        <p className="text-sm leading-6 text-foreground/70">
          The investigation workspace is under construction. This scaffold
          exists so the vertical slice — auth, product context, failure
          state, hypotheses, and evidence — can be built ticket by ticket.
        </p>
      </div>
    </div>
  );
}
