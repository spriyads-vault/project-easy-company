"use client";

// Auth enterprise redesign: shared by the sign-in and sign-up password
// fields — a real show/hide toggle (not decorative), keyboard operable
// (a plain <button>, tab-reachable, Enter/Space work natively) and its
// state is announced via aria-pressed + a label that names what the
// control currently shows, not just "toggle".
//
// UX-13: used only by these two auth forms (never imported elsewhere —
// verified), so its toggle button reads the frozen `--auth-*` tokens
// rather than tokens.ts's theme-reactive `focusRing`/text-muted-
// foreground — /login and /signup are light-only by explicit product
// decision, and those theme tokens would flip under a visitor's OS/
// stored dark preference.
import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { authFocusRing } from "./auth-tokens";

type PasswordInputProps = Omit<React.ComponentProps<typeof Input>, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const generatedId = useId();
    const inputId = id ?? generatedId;

    return (
      <div className="relative">
        <Input
          {...props}
          id={inputId}
          ref={ref}
          type={visible ? "text" : "password"}
          className={`pr-10 ${className ?? ""}`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-pressed={visible}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
          className={`absolute inset-y-0 right-0 flex w-10 items-center justify-center text-auth-muted transition-colors hover:text-auth-foreground ${authFocusRing}`}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
