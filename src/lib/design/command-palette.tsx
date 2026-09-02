"use client";

// COMMAND PALETTE (UX-04 Agent-Native): Cmd/Ctrl+K, opened from the
// sidebar's Search action too. Static navigational commands plus real
// recent investigations/products passed down from the server shell — no
// client-side search-everything endpoint exists yet, so "Search sources"
// routes to the real Sources hybrid-search page rather than faking a
// second search surface here.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, FolderOpen, LayoutList, Package, PlusCircle, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export interface PaletteInvestigation {
  id: string;
  title: string;
  productName: string;
  revisionLabel: string;
}

export interface PaletteProduct {
  id: string;
  name: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentInvestigations: PaletteInvestigation[];
  products: PaletteProduct[];
}

export function CommandPalette({ open, onOpenChange, recentInvestigations, products }: CommandPaletteProps) {
  const router = useRouter();

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search investigations, products, sources…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/investigations/new")}>
            <PlusCircle />
            New investigation
          </CommandItem>
          <CommandItem onSelect={() => go("/documents")}>
            <Search />
            Search sources
          </CommandItem>
          <CommandItem onSelect={() => go("/documents")}>
            <FilePlus2 />
            Add source
          </CommandItem>
        </CommandGroup>
        {recentInvestigations.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent investigations">
              {recentInvestigations.map((investigation) => (
                <CommandItem key={investigation.id} onSelect={() => go(`/cases/${investigation.id}/investigation`)}>
                  <LayoutList />
                  <span className="truncate">{investigation.title}</span>
                  <CommandShortcut className="truncate">
                    {investigation.productName} {investigation.revisionLabel}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {products.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem key={product.id} onSelect={() => go(`/products/${product.id}`)}>
                  <Package />
                  {product.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => go("/investigations")}>
            <LayoutList />
            Investigations
          </CommandItem>
          <CommandItem onSelect={() => go("/products")}>
            <Package />
            Products
          </CommandItem>
          <CommandItem onSelect={() => go("/documents")}>
            <FolderOpen />
            Sources
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Cmd/Ctrl+K anywhere in the app shell opens the palette. One hook, used
 * once by AppShellChrome — kept separate so it's easy to see this is the
 * shell's only global keyboard shortcut. */
export function useCommandPaletteShortcut() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}
