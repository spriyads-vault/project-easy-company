// Standard shadcn/ui utility — merges conditional class lists and resolves
// conflicting Tailwind classes (e.g. two different `px-*` values) so the
// last one wins predictably. Every shadcn primitive in src/components/ui
// is built on this.
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
