import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets, image optimization,
     * the favicon, and robots.txt, so the session cookie stays fresh
     * everywhere else. robots.txt (favicon/metadata ticket: src/app/
     * robots.ts) was found live-redirecting to /login — it isn't a
     * static file under public/ so the image-extension exclusion below
     * didn't cover it, and it isn't one of PUBLIC_PATHS either (that
     * list is for real pages, not metadata routes); a crawler hitting
     * it got a 307 to a sign-in page instead of the disallow rules.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
