"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/auth/credentials";

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
    return { error: "Could not sign in. Check your email and password." };
  }

  revalidatePath("/", "layout");
  redirect("/workspace");
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
    return { error: "Could not create an account with those details." };
  }

  // With email confirmation enabled (the production default), signUp
  // returns no session until the user clicks the confirmation link.
  if (!data.session) {
    return { message: "Check your email to confirm your account." };
  }

  revalidatePath("/", "layout");
  redirect("/workspace");
}
