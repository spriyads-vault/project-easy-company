import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect";
import { AuthShell } from "@/lib/design/auth-shell";
import { SignUpForm } from "./sign-up-form";

// Favicon/metadata ticket: see login/page.tsx's matching comment —
// renders as "Create account · Crado" via the root title template.
export const metadata: Metadata = {
  title: "Create account",
};

// Auth enterprise redesign: new route — previously /login rendered both
// the sign-in and sign-up forms as two buttons in one card. See
// src/app/login/page.tsx for the matching "already authenticated"
// redirect rationale.
interface SignupPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { next: nextParam } = await searchParams;
  const next = sanitizeRedirectTarget(nextParam);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next);
  }

  return (
    <AuthShell mode="sign-up" next={next}>
      <SignUpForm next={next} />
    </AuthShell>
  );
}
