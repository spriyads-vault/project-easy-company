// Auth enterprise redesign: one small presentational banner shared by
// every auth notice — query-string-driven page-level notices (expired
// session, invalid confirmation link) and in-form action-state results
// (credential errors, "check your email"). Colour is never the only
// signal: error carries role="alert", success/info carry role="status"
// with aria-live="polite", satisfying "status is never communicated by
// colour alone" without each call site re-deriving it.
interface AuthBannerProps {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
}

const TONE_CLASS: Record<AuthBannerProps["tone"], string> = {
  error: "border-destructive/40 bg-destructive/10 text-destructive",
  success: "border-success/40 bg-success/10 text-success",
  info: "border-border bg-secondary text-foreground",
};

export function AuthBanner({ tone, children }: AuthBannerProps) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`rounded-[6px] border px-3 py-2 text-[13px] leading-snug ${TONE_CLASS[tone]}`}
    >
      {children}
    </p>
  );
}
