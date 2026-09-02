// EMPTY STATE (UX-04): one honest, quiet empty-state shape reused by
// every list page (products, revisions, documents, benchmarks) instead
// of each page inventing its own wording/spacing. Never implies data
// exists that doesn't — always a plain sentence, never a skeleton
// pretending to load something real.
import { text } from "./tokens";

interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <p className={`text-sm ${text.muted}`}>{message}</p>
      {action}
    </div>
  );
}
