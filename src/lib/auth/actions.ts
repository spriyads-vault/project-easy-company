"use server";

// Enterprise auth redesign: relocated from src/app/login/actions.ts so
// both /login and /signup (previously only /login existed) can import
// the same signIn/signUp actions instead of duplicating them.
//
// Auth provider/credential strategy/session model are unchanged — this
// file still does exactly what it did before (Supabase email+password,
// same signInWithPassword/signUp calls, same session-presence check for
// "does signup need email confirmation"). What's new: (1) errors are
// mapped to honest, specific copy instead of one generic string per
// action, using only fields Supabase's AuthError actually exposes —
// never guessing at a cause the SDK didn't report; (2) the post-auth
// destination is the caller's real intended route (sanitized), not
// always a hardcoded "/investigations".
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/auth/credentials";
import { sanitizeRedirectTarget } from "@/lib/auth/redirect";
import { mapAuthError } from "@/lib/auth/map-auth-error";

export interface AuthFormState {
  error?: string;
  message?: string;
}

function parseCredentials(formData: FormData): AuthFormState & {
  email?: string;
  password?: string;
} {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  return { email: parsed.data.email, password: parsed.data.password };
}

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (parsed.error || !parsed.email || !parsed.password) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    return { error: mapAuthError(error, "signIn") };
  }

  const next = sanitizeRedirectTarget(formData.get("next")?.toString());
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = parseCredentials(formData);
  if (parsed.error || !parsed.email || !parsed.password) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    return { error: mapAuthError(error, "signUp") };
  }

  // With email confirmation enabled (the production default), signUp
  // returns no session until the user clicks the confirmation link.
  if (!data.session) {
    return { message: "Check your email to confirm your account." };
  }

  const next = sanitizeRedirectTarget(formData.get("next")?.toString());
  revalidatePath("/", "layout");
  redirect(next);
}
