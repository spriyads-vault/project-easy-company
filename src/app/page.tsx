import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// UX-09: the root route is not a page — it's a dispatcher. It used to
// render an MVP-01 scaffold ("under construction…") with a manual Sign
// in link; that scaffold had no reason to exist once the real
// sign-in/investigations flow shipped, and middleware.ts's own
// PUBLIC_PATHS list keeps "/" reachable for an unauthenticated visitor
// (it must stay reachable so this component gets a chance to run), so
// nothing upstream already does this redirect. A signed-in visitor goes
// straight to their workspace; a signed-out one goes straight to
// /login, the same "already authenticated → redirect" check login/page.tsx
// and signup/page.tsx do, just in the opposite direction.
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/investigations" : "/login");
}
